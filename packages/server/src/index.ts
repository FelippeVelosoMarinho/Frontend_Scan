import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { extractToRawTokens, runPythonCluster } from "@ds-extractor/scanner/api";

const PORT = Number(process.env.PORT ?? 3847);

async function main(): Promise<void> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/api/final-tokens", async (req, reply) => {
    const p = path.join(process.cwd(), "final-tokens.json");
    if (!fs.existsSync(p)) {
      return reply.code(404).send({ error: "final-tokens.json não encontrado no cwd do servidor" });
    }
    const doc = JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
    return reply.send(doc);
  });

  app.post<{ Body: { url?: string; maxElements?: number; waitMs?: number; selectorWait?: string } }>(
    "/api/scan",
    async (req, reply) => {
      const url = req.body?.url;
      if (!url || typeof url !== "string") {
        return reply.code(400).send({ ok: false, error: "Informe url" });
      }
      const maxElements = req.body.maxElements ?? 800;
      const tmp = os.tmpdir();
      const rawPath = path.join(tmp, `ds-raw-${Date.now()}.json`);
      const finalPath = path.join(tmp, `ds-final-${Date.now()}.json`);
      try {
        const rawTokens = await extractToRawTokens({
          url,
          maxElements,
          extraWaitMs: req.body.waitMs,
          waitForSelector: req.body.selectorWait,
        });
        fs.writeFileSync(rawPath, JSON.stringify(rawTokens, null, 2), "utf8");
        runPythonCluster(rawPath, finalPath);
        const finalObj = JSON.parse(fs.readFileSync(finalPath, "utf8")) as unknown;
        const outFinal = path.join(process.cwd(), "final-tokens.json");
        fs.writeFileSync(outFinal, JSON.stringify(finalObj, null, 2), "utf8");
        return { ok: true, final: finalObj };
      } catch (e) {
        req.log.error(e);
        return reply.code(500).send({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  );

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.error(`DS-Extractor API em http://127.0.0.1:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
