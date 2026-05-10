import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function repoRootFromScanner(): string {
  return path.resolve(__dirname, "../../..");
}

export function runPythonCluster(rawPath: string, finalPath: string): void {
  const root = repoRootFromScanner();
  const clusterPy = path.join(root, "python/cluster/cluster.py");
  if (!fs.existsSync(clusterPy)) {
    throw new Error(`Script Python não encontrado: ${clusterPy}`);
  }
  const py = process.env.PYTHON ?? "python3";
  const res = spawnSync(py, [clusterPy, "--in", rawPath, "--out", finalPath], {
    stdio: "inherit",
    encoding: "utf8",
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`Python terminou com código ${res.status}`);
  }
}
