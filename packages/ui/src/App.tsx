import { useCallback, useEffect, useMemo, useState } from "react";
import { generateStylesBundleFromDtcg } from "@ds-extractor/style-export";
import { LivePreview } from "./components/LivePreview";
import { TokenTable } from "./components/TokenTable";
import { collectLeaves } from "./lib/walkTokens";

type Section = "colors" | "typography" | "spacing" | "motion" | "preview";

const NAV: { id: Section; label: string }[] = [
  { id: "colors", label: "Cores" },
  { id: "typography", label: "Tipografia" },
  { id: "spacing", label: "Espaçamento" },
  { id: "motion", label: "Animações" },
  { id: "preview", label: "Live Preview" },
];

function normalizeScanUrl(input: string): string {
  const t = input.trim();
  if (!t) throw new Error("Indique o URL do site a extrair.");
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  const u = new URL(withProto);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Use um URL http ou https.");
  }
  return u.toString();
}

function friendlyFetchError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg === "Failed to fetch" ||
    msg.includes("NetworkError") ||
    msg.includes("Network request failed")
  ) {
    return "Não foi possível contactar a API local. Na raiz do repositório execute npm run dev (inicia a interface e o servidor na porta 3847). Certifique-se de que Python 3 e as dependências em python/cluster estão instaladas e que o Chromium do Playwright está disponível (npx playwright install chromium).";
  }
  return msg;
}

export default function App() {
  const [section, setSection] = useState<Section>("colors");
  const [tokens, setTokens] = useState<unknown>(null);
  const [lastScannedUrl, setLastScannedUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(true);
  const [scanUrl, setScanUrl] = useState("https://example.com");
  const [scanBusy, setScanBusy] = useState(false);
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/final-tokens")
      .then(() => {
        if (!cancelled) setApiReachable(true);
      })
      .catch(() => {
        if (!cancelled) setApiReachable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rawText = useMemo(() => (tokens ? JSON.stringify(tokens, null, 2) : null), [tokens]);

  const bundle = useMemo(() => (tokens ? generateStylesBundleFromDtcg(tokens) : null), [tokens]);

  useEffect(() => {
    const id = "ds-extractor-theme-vars";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!bundle) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = bundle.themeCss;
    return () => {
      el?.remove();
    };
  }, [bundle]);

  const leaves = useMemo(() => (tokens ? collectLeaves(tokens) : []), [tokens]);

  const colorRows = useMemo(
    () =>
      leaves
        .filter((x) => x.leaf.$type === "color")
        .map((x) => ({
          path: x.path,
          value: String(x.leaf.$value),
          extra: (
            <span
              className="inline-block h-6 w-6 rounded border border-zinc-300 dark:border-zinc-600"
              style={{ backgroundColor: String(x.leaf.$value) }}
            />
          ),
        })),
    [leaves]
  );

  const fontRows = useMemo(
    () =>
      leaves
        .filter((x) => x.leaf.$type === "fontFamily")
        .map((x) => ({ path: x.path, value: String(x.leaf.$value) })),
    [leaves]
  );

  const dimRows = useMemo(
    () =>
      leaves
        .filter((x) => x.leaf.$type === "dimension")
        .map((x) => ({ path: x.path, value: String(x.leaf.$value) })),
    [leaves]
  );

  const motionRows = useMemo(
    () =>
      leaves
        .filter((x) => x.leaf.$type === "cubicBezier" || x.leaf.$type === "duration")
        .map((x) => ({
          path: x.path,
          value: typeof x.leaf.$value === "object" ? JSON.stringify(x.leaf.$value) : String(x.leaf.$value),
        })),
    [leaves]
  );

  const downloadZip = useCallback(async () => {
    if (!bundle) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const folder = zip.folder("styles");
    if (!folder) return;
    folder.file("tokens.json", bundle.tokensJson);
    folder.file("theme.css", bundle.themeCss);
    folder.file("tailwind.config.js", bundle.tailwindConfigJs);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const host = (() => {
      try {
        return new URL(lastScannedUrl || scanUrl).hostname.replace(/[^a-z0-9.-]/gi, "_");
      } catch {
        return "design-system";
      }
    })();
    a.download = `ds-extractor-${host}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [bundle, lastScannedUrl, scanUrl]);

  const runScan = useCallback(async () => {
    setScanBusy(true);
    setError(null);
    try {
      const url = normalizeScanUrl(scanUrl);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, maxElements: 800 }),
      });
      let data: { ok?: boolean; error?: string; final?: unknown };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        throw new Error("Resposta inválida da API.");
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `${res.status} ${res.statusText}`);
      }
      if (!data.final) throw new Error("A API não devolveu tokens finais.");
      setTokens(data.final);
      setLastScannedUrl(url);
      setSection("colors");
    } catch (e) {
      setError(friendlyFetchError(e));
      setTokens(null);
      setLastScannedUrl("");
    } finally {
      setScanBusy(false);
    }
  }, [scanUrl]);

  const showSidebar = Boolean(tokens);

  return (
    <div className="flex min-h-screen flex-col">
      {apiReachable === false && (
        <div
          className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          <strong className="font-semibold">API não detetada.</strong> Execute na raiz do projeto{" "}
          <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-900/80">npm run dev</code> para iniciar a
          interface (porta 5173) e o servidor de extração (porta 3847). São necessários Python 3 com{" "}
          <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-900/80">pip install -r python/cluster/requirements.txt</code>{" "}
          e Chromium do Playwright.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {showSidebar && (
          <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Demonstração</div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Tokens extraídos</div>
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 p-2">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSection(n.id)}
                  className={`rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    section === n.id
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </nav>
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setDark(!dark)}
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700"
              >
                {dark ? "Modo claro" : "Modo escuro"}
              </button>
            </div>
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-auto">
          <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:px-10">
            <div className="mx-auto max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">DS-Extractor</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Extração e demonstração por URL
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                Indique o endereço do site. Os tokens são obtidos a partir do estado renderizado (Playwright) e
                agrupados no servidor; pode descarregar o pacote pronto para o seu projeto.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                <label className="sr-only" htmlFor="scan-url">
                  URL do site
                </label>
                <input
                  id="scan-url"
                  className="min-h-11 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={scanUrl}
                  onChange={(e) => setScanUrl(e.target.value)}
                  placeholder="https://exemplo.com"
                  disabled={scanBusy}
                  autoComplete="url"
                />
                <button
                  type="button"
                  disabled={scanBusy}
                  onClick={() => void runScan()}
                  className="min-h-11 shrink-0 rounded-lg bg-zinc-900 px-6 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {scanBusy ? "A extrair…" : "Extrair e demonstrar"}
                </button>
              </div>
              {scanBusy && (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  A navegar e a amostrar o DOM renderizado; em seguida o cluster Python gera os tokens finais. Pode
                  demorar um minuto em sites pesados.
                </p>
              )}

              {tokens && lastScannedUrl && (
                <div className="mt-6 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Site analisado</p>
                    <p className="mt-1 break-all font-mono text-sm text-zinc-900 dark:text-zinc-100">{lastScannedUrl}</p>
                    <p className="mt-1 text-xs text-zinc-500">{leaves.length} tokens (folhas DTCG)</p>
                  </div>
                  <button
                    type="button"
                    disabled={!bundle}
                    onClick={() => void downloadZip()}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    Baixar design system (ZIP)
                  </button>
                </div>
              )}

              {error && (
                <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
            </div>
          </header>

          <div className="mx-auto max-w-4xl px-6 py-8 md:px-10">
            {!tokens && !scanBusy && (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                Introduza um URL e pressione <strong className="font-medium text-zinc-700 dark:text-zinc-300">Extrair e demonstrar</strong> para ver a tabela de tokens e o preview com as variáveis CSS geradas.
              </p>
            )}

            {tokens && (
              <>
                {section === "colors" && <TokenTable title="Cores" rows={colorRows} />}
                {section === "typography" && <TokenTable title="Tipografia" rows={fontRows} />}
                {section === "spacing" && <TokenTable title="Espaçamento" rows={dimRows} />}
                {section === "motion" && <TokenTable title="Motion" rows={motionRows} />}
                {section === "preview" && <LivePreview tokens={tokens} />}
                {rawText && (
                  <details className="mt-10 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Tokens JSON (referência)
                    </summary>
                    <pre className="max-h-96 overflow-auto border-t border-zinc-200 p-4 text-xs dark:border-zinc-800">
                      {rawText.slice(0, 24000)}
                      {rawText.length > 24000 ? "\n…" : ""}
                    </pre>
                  </details>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
