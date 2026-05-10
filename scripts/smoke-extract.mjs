#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "packages/scanner/dist/cli.js");
if (!fs.existsSync(cli)) {
  console.error("Build o scanner antes: npm run build -w @ds-extractor/scanner");
  process.exit(1);
}

const outRaw = path.join(root, "raw-tokens.json");
const outFinal = path.join(root, "final-tokens.json");

const r = spawnSync(
  process.execPath,
  [
    cli,
    "--url",
    "https://example.com",
    "--out",
    outRaw,
    "--final-out",
    outFinal,
    "--max-elements",
    "40",
    "--wait-until",
    "domcontentloaded",
    "--styles-out",
    path.join(root, "out/styles"),
  ],
  { stdio: "inherit", cwd: root, env: process.env }
);

if (r.status !== 0) {
  process.exit(r.status ?? 1);
}
if (!fs.existsSync(outFinal)) {
  console.error("Smoke falhou: final-tokens.json não foi gerado");
  process.exit(1);
}
console.error("Smoke OK:", outFinal);
