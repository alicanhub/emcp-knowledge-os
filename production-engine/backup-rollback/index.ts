export type BackupType = "full" | "incremental";
export interface BackupFile {
  readonly path: string;
  readonly sha256: string;
  readonly size: number;
  readonly storedInVersion: string;
}
export interface BackupManifest {
  readonly manifestVersion: 1;
  readonly versionId: string;
  readonly type: BackupType;
  readonly parentVersionId: string | null;
  readonly createdAt: string;
  readonly runtimeCount: number;
  readonly files: readonly BackupFile[];
  readonly changedFiles: readonly string[];
  readonly deletedFiles: readonly string[];
}
export interface BackupReport {
  readonly version: 1;
  readonly operation: "backup";
  readonly manifest: BackupManifest;
  readonly completedAt: string;
  readonly integrityVerified: true;
}
export interface RestoreReport {
  readonly version: 1;
  readonly operation: "restore";
  readonly versionId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly restoredFiles: number;
  readonly runtimeCount: number;
  readonly integrityVerified: true;
  readonly automatic: boolean;
}
export interface BackupRollbackEngine {
  createSnapshot(request?: {
    type?: BackupType;
    versionId?: string;
  }): Promise<BackupReport>;
  list(): Promise<readonly BackupManifest[]>;
  history(): Promise<readonly Record<string, unknown>[]>;
  verify(versionId: string): Promise<boolean>;
  restore(
    versionId: string,
    options?: { automatic?: boolean },
  ): Promise<RestoreReport>;
}
export {
  JsonBackupRollbackEngine,
  BackupRollbackError,
} from "./backup-rollback-engine.js";
