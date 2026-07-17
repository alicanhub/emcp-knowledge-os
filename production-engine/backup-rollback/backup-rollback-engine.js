import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export class BackupRollbackError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BackupRollbackError";
    this.code = code;
  }
}
const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

export class JsonBackupRollbackEngine {
  #runtimeDirectory;
  #backupDirectory;
  #reportsDirectory;
  #auditFile;
  #clock;
  #faultInjector;
  /** @param {any} options */
  constructor(options = {}) {
    for (const field of [
      "runtimeDirectory",
      "backupDirectory",
      "reportsDirectory",
      "auditFile",
    ])
      if (!options[field])
        throw new BackupRollbackError(
          "invalid_configuration",
          `${field} is required.`,
        );
    this.#runtimeDirectory = options.runtimeDirectory;
    this.#backupDirectory = options.backupDirectory;
    this.#reportsDirectory = options.reportsDirectory;
    this.#auditFile = options.auditFile;
    this.#clock = options.clock || (() => new Date());
    this.#faultInjector = options.faultInjector || null;
  }
  async createSnapshot({
    type = "full",
    versionId = this.#defaultVersionId(),
  } = {}) {
    if (!["full", "incremental"].includes(type))
      throw new BackupRollbackError(
        "invalid_type",
        `Unknown backup type: ${type}`,
      );
    if (!/^[a-zA-Z0-9._-]+$/.test(versionId))
      throw new BackupRollbackError(
        "invalid_version",
        "Version IDs may contain letters, numbers, dots, underscores and hyphens.",
      );
    const directory = path.join(this.#backupDirectory, versionId);
    if (await this.#exists(directory))
      throw new BackupRollbackError(
        "duplicate_version",
        `Backup version already exists: ${versionId}`,
      );
    const previous = (await this.list()).at(-1) || null;
    if (type === "incremental" && !previous)
      throw new BackupRollbackError(
        "missing_parent",
        "An incremental backup requires an earlier snapshot.",
      );
    const current = await this.#scan(this.#runtimeDirectory),
      parentFiles = new Map(
        (previous?.files || []).map((file) => [file.path, file]),
      );
    const changedFiles = [...current]
      .filter(
        ([file, metadata]) =>
          type === "full" || parentFiles.get(file)?.sha256 !== metadata.sha256,
      )
      .map(([file]) => file);
    const deletedFiles = previous
      ? previous.files
          .filter((file) => !current.has(file.path))
          .map((file) => file.path)
      : [];
    const files = [...current]
      .map(([file, metadata]) => ({
        path: file,
        sha256: metadata.sha256,
        size: metadata.size,
        storedInVersion: changedFiles.includes(file)
          ? versionId
          : parentFiles.get(file).storedInVersion,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
    const manifest = {
      manifestVersion: 1,
      versionId,
      type,
      parentVersionId: type === "incremental" ? previous.versionId : null,
      createdAt: this.#clock().toISOString(),
      runtimeCount: await this.#runtimeCount(this.#runtimeDirectory),
      files,
      changedFiles,
      deletedFiles,
    };
    try {
      for (const file of changedFiles) {
        const destination = path.join(directory, "files", file);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.copyFile(path.join(this.#runtimeDirectory, file), destination);
      }
      await this.#writeJson(path.join(directory, "manifest.json"), manifest);
      await this.verify(versionId);
      const report = {
        version: 1,
        operation: "backup",
        manifest,
        completedAt: this.#clock().toISOString(),
        integrityVerified: true,
      };
      await this.#writeJson(
        path.join(this.#reportsDirectory, `${versionId}.backup.json`),
        report,
      );
      await this.#appendAudit({
        timestamp: report.completedAt,
        action: "backup-created",
        versionId,
        type,
        parentVersionId: manifest.parentVersionId,
        changedFiles: changedFiles.length,
        deletedFiles: deletedFiles.length,
      });
      return report;
    } catch (error) {
      await fs.rm(directory, { recursive: true, force: true });
      if (error instanceof BackupRollbackError) throw error;
      throw new BackupRollbackError(
        "backup_failed",
        `Backup failed: ${error.message}`,
      );
    }
  }
  async list() {
    let names = [];
    try {
      names = await fs.readdir(this.#backupDirectory);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    const manifests = [];
    for (const name of names) {
      const file = path.join(this.#backupDirectory, name, "manifest.json");
      if (await this.#exists(file))
        manifests.push(JSON.parse(await fs.readFile(file, "utf8")));
    }
    return manifests.sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        a.versionId.localeCompare(b.versionId),
    );
  }
  async verify(versionId) {
    const manifest = await this.#manifest(versionId);
    for (const file of manifest.files) {
      this.#safeRelative(file.path);
      this.#safeRelative(file.storedInVersion);
      const blob = path.join(
        this.#backupDirectory,
        file.storedInVersion,
        "files",
        file.path,
      );
      let content;
      try {
        content = await fs.readFile(blob);
      } catch (error) {
        throw new BackupRollbackError(
          "integrity_failed",
          `Backup file missing for ${file.path}: ${error.message}`,
        );
      }
      if (content.length !== file.size || sha256(content) !== file.sha256)
        throw new BackupRollbackError(
          "integrity_failed",
          `Checksum mismatch for ${file.path}.`,
        );
    }
    return true;
  }

  async history() {
    try {
      const document = JSON.parse(await fs.readFile(this.#auditFile, "utf8"));
      if (document?.version !== 1 || !Array.isArray(document.events))
        throw new BackupRollbackError(
          "invalid_audit",
          "Backup audit history is invalid.",
        );
      return structuredClone(document.events);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }
  async restore(versionId, { automatic = false } = {}) {
    const startedAt = this.#clock().toISOString();
    await this.verify(versionId);
    const manifest = await this.#manifest(versionId),
      parent = path.dirname(this.#runtimeDirectory),
      token = crypto.randomUUID(),
      stage = path.join(parent, `.restore-stage-${token}`),
      rollback = path.join(parent, `.restore-rollback-${token}`);
    let swapped = false;
    try {
      for (const file of manifest.files) {
        const source = path.join(
            this.#backupDirectory,
            file.storedInVersion,
            "files",
            file.path,
          ),
          destination = path.join(stage, file.path);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.copyFile(source, destination);
      }
      const staged = await this.#scan(stage);
      for (const file of manifest.files)
        if (staged.get(file.path)?.sha256 !== file.sha256)
          throw new BackupRollbackError(
            "integrity_failed",
            `Staged checksum mismatch for ${file.path}.`,
          );
      if (this.#faultInjector) await this.#faultInjector("before-swap");
      await fs.rename(this.#runtimeDirectory, rollback);
      await fs.rename(stage, this.#runtimeDirectory);
      swapped = true;
      if (this.#faultInjector) await this.#faultInjector("after-swap");
      const report = {
        version: 1,
        operation: "restore",
        versionId,
        startedAt,
        completedAt: this.#clock().toISOString(),
        restoredFiles: manifest.files.length,
        runtimeCount: await this.#runtimeCount(this.#runtimeDirectory),
        integrityVerified: true,
        automatic,
      };
      if (report.runtimeCount !== manifest.runtimeCount)
        throw new BackupRollbackError(
          "integrity_failed",
          "Restored runtime count does not match the manifest.",
        );
      await this.#writeJson(
        path.join(
          this.#reportsDirectory,
          `${versionId}.${automatic ? "automatic-" : ""}restore.json`,
        ),
        report,
      );
      await this.#appendAudit({
        timestamp: report.completedAt,
        action: automatic ? "automatic-rollback" : "backup-restored",
        versionId,
        restoredFiles: report.restoredFiles,
        runtimeCount: report.runtimeCount,
      });
      await fs.rm(rollback, { recursive: true, force: true });
      return report;
    } catch (error) {
      if (swapped) {
        await fs.rm(this.#runtimeDirectory, { recursive: true, force: true });
        await fs.rename(rollback, this.#runtimeDirectory);
      }
      await fs.rm(stage, { recursive: true, force: true });
      if (error instanceof BackupRollbackError) throw error;
      throw new BackupRollbackError(
        "restore_failed",
        `Restore failed: ${error.message}`,
      );
    }
  }
  async #manifest(versionId) {
    this.#safeRelative(versionId);
    const file = path.join(this.#backupDirectory, versionId, "manifest.json");
    let value;
    try {
      value = JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      throw new BackupRollbackError(
        "version_not_found",
        `Cannot read backup ${versionId}: ${error.message}`,
      );
    }
    if (
      value.manifestVersion !== 1 ||
      value.versionId !== versionId ||
      !Array.isArray(value.files)
    )
      throw new BackupRollbackError(
        "invalid_manifest",
        `Backup manifest is invalid: ${versionId}`,
      );
    return value;
  }
  async #scan(directory) {
    const files = new Map();
    const visit = async (folder) => {
      for (const item of await fs.readdir(folder, { withFileTypes: true })) {
        const file = path.join(folder, item.name);
        if (item.isDirectory()) await visit(file);
        else if (item.isFile()) {
          const content = await fs.readFile(file),
            relative = path.relative(directory, file).split(path.sep).join("/");
          files.set(relative, {
            sha256: sha256(content),
            size: content.length,
          });
        }
      }
    };
    await visit(directory);
    return files;
  }
  async #runtimeCount(directory) {
    const index = JSON.parse(
      await fs.readFile(path.join(directory, "index.json"), "utf8"),
    );
    let count = 0;
    for (const category of index.categories)
      count += JSON.parse(
        await fs.readFile(path.join(directory, category.file), "utf8"),
      ).length;
    return count;
  }
  #defaultVersionId() {
    return `backup.${this.#clock()
      .toISOString()
      .replace(/[-:.TZ]/g, "")}.${crypto.randomUUID()}`;
  }
  #safeRelative(value) {
    if (
      typeof value !== "string" ||
      !value ||
      path.isAbsolute(value) ||
      value.split(/[\\/]/).includes("..")
    )
      throw new BackupRollbackError(
        "invalid_path",
        `Unsafe backup path: ${value}`,
      );
  }
  async #exists(file) {
    try {
      await fs.access(file);
      return true;
    } catch {
      return false;
    }
  }
  async #appendAudit(event) {
    let document = { version: 1, events: [] };
    try {
      document = JSON.parse(await fs.readFile(this.#auditFile, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    document.events.push(event);
    await this.#writeJson(this.#auditFile, document);
  }
  async #writeJson(file, value) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(
      temporary,
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8",
    );
    await fs.rename(temporary, file);
  }
}
