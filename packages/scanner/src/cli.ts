#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { cac } from "cac";
import { extractToRawTokens } from "./extract.js";
import { runStyleDictionary } from "./style-dictionary-build.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function repoRootFromScanner(): string {
  return path.resolve(__dirname, "../../..");
}

const cli = cac("ds-extract");

cli
  .option("--url <url>", "URL alvo (obrigatório)")
  .option("--out <file>", "Saída raw JSON", { default: "raw-tokens.json" })
  .option("--final-out <file>", "Saída final após Python", { default: "final-tokens.json" })
  .option("--max-elements <n>", "Máximo de elementos DOM amostrados", {
    default: String(800),
  })
  .option("--viewport <wxh>", "Viewport (ex: 1280x800)", { default: "1280x800" })
  .option("--wait-until <mode>", "Playwright waitUntil", {
    default: "networkidle",
  })
  .option("--skip-python", "Não executar cluster Python")
  .option("--skip-build", "Não rodar Style Dictionary após final")
  .option("--styles-out <dir>", "Diretório de export Style Dictionary", {
    default: "out/styles",
  })
  .help();

async function main(): Promise<void> {
  const parsed = cli.parse(process.argv, { run: false });
  const opts = parsed.options as Record<string, unknown>;

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.exit(0);
  }

  const url = opts.url as string | undefined;
  if (!url) {
    console.error("Erro: informe --url");
    process.exit(1);
  }

  const maxElements = Number(opts.maxElements ?? 800);
  const [vw, vh] = String(opts.viewport ?? "1280x800")
    .split(/[xX]/)
    .map((x) => Number(x.trim()));
  const waitUntil = opts.waitUntil as "load" | "domcontentloaded" | "networkidle";

  const rawPath = path.resolve(process.cwd(), String(opts.out ?? "raw-tokens.json"));
  const finalPath = path.resolve(process.cwd(), String(opts.finalOut ?? "final-tokens.json"));

  console.error(`Extraindo ${url} …`);
  const raw = await extractToRawTokens({
    url,
    maxElements,
    viewportWidth: vw || 1280,
    viewportHeight: vh || 800,
    waitUntil,
  });

  fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2), "utf8");
  console.error(`Gravado: ${rawPath}`);

  if (!opts.skipPython) {
    const root = repoRootFromScanner();
    const clusterPy = path.join(root, "python/cluster/cluster.py");
    if (!fs.existsSync(clusterPy)) {
      console.error(`Script Python não encontrado: ${clusterPy}`);
      process.exit(1);
    }
    const py = process.env.PYTHON ?? "python3";
    const res = spawnSync(py, [clusterPy, "--in", rawPath, "--out", finalPath], {
      stdio: "inherit",
      encoding: "utf8",
    });
    if (res.error) {
      console.error(res.error);
      process.exit(1);
    }
    if (res.status !== 0) {
      console.error(`Python terminou com código ${res.status}`);
      process.exit(res.status ?? 1);
    }
    console.error(`Gravado: ${finalPath}`);
  }

  if (!opts.skipBuild && fs.existsSync(finalPath)) {
    const stylesDir = path.resolve(process.cwd(), String(opts.stylesOut ?? "out/styles"));
    await runStyleDictionary(finalPath, stylesDir);
    console.error(`Exports em: ${stylesDir}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
