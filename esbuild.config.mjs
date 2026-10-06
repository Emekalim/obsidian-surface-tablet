import esbuild from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import process from "node:process";

const production = process.argv[2] === "production";
const outputDirectory = "dist";

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  ["manifest.json", "styles.css"].map((file) => copyFile(file, `${outputDirectory}/${file}`)),
);

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron"],
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: `${outputDirectory}/main.js`,
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
  console.log(`Watching Surface Tablet sources in ${outputDirectory}/...`);
}
