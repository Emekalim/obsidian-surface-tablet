import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const [manifest, packageJson, versions] = await Promise.all([
  readJson("manifest.json"),
  readJson("package.json"),
  readJson("versions.json"),
]);

const failures = [];

if (manifest.version !== packageJson.version) {
  failures.push(
    `manifest version ${manifest.version} does not match package ${packageJson.version}`,
  );
}

if (versions[manifest.version] !== manifest.minAppVersion) {
  failures.push(
    `versions.json must map ${manifest.version} to minimum app version ${manifest.minAppVersion}`,
  );
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Version metadata is consistent at ${manifest.version}.`);
}
