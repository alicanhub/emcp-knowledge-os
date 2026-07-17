import assert from "node:assert/strict";
import { access, cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd(),
  destination = path.join(root, "dist");
const applicationAssets = [
  "index.html",
  "offline.html",
  "manifest.webmanifest",
  "service-worker.js",
  "icon.svg",
  "LICENSE",
  "README.md",
  "css",
  "js",
  "data",
  "config",
];
const runtimeContent = [
  "content/handbooks/investor/handbook.json",
  "content/handbooks/investor/chapters.json",
  "content/checklists/investor-checklists.json",
  "content/case-studies/investor-case-studies.json",
  "content/document-guides/property-purchase-documents.json",
];

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(
        ...(await listFiles(path.join(directory, entry.name), relativePath)),
      );
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const asset of applicationAssets)
  await cp(path.join(root, asset), path.join(destination, asset), {
    recursive: true,
  });
for (const asset of runtimeContent) {
  const target = path.join(destination, asset);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(root, asset), target);
}
await access(path.join(destination, "config/runtime.json"));

const builtContent = (await listFiles(path.join(destination, "content")))
  .map((file) => `content/${file}`)
  .sort();
assert.deepEqual(
  builtContent,
  runtimeContent.toSorted(),
  "Production content must contain only the runtime allowlist",
);
await assert.rejects(
  access(path.join(destination, "admin")),
  "The internal admin application must not be included in production builds",
);

console.log(
  `Built production application with ${runtimeContent.length} runtime content files in dist/`,
);
