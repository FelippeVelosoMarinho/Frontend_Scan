/** Relatório narrativo heurístico para colar no Cursor/Claude — linguagem prudente (“observado”, “sugerido”). */

function parsePx(val: string | undefined): number | null {
  if (!val) return null;
  const m = /^([\d.]+)px$/.exec(val.trim());
  return m ? parseFloat(m[1]) : null;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function buildReferencePromptMarkdown(raw: unknown, final: unknown): string {
  const r = raw as Record<string, unknown>;
  const f = final as Record<string, unknown>;
  const metaR = (r.meta as Record<string, unknown>) ?? {};
  const metaF = (f.meta as Record<string, unknown>) ?? {};
  const url = String(metaR.url ?? metaF.sourceUrl ?? "").trim();
  const samples = (r.computedSamples as Array<{ styles: Record<string, string> }>) ?? [];
  const outline = (r.domOutline as Array<{ tagName: string; depth: number }>) ?? [];
  const micro = (r.microInteractions as Array<{ selectorHint: string; idle: Record<string, string>; hovered: Record<string, string> }>) ?? [];

  const radii: number[] = [];
  const fontSizes: number[] = [];
  const lineHeights: number[] = [];
  let shadowHits = 0;

  for (const s of samples) {
    const st = s.styles ?? {};
    const br = parsePx(st["border-radius"]);
    if (br !== null) radii.push(br);
    const fs = parsePx(st["font-size"]);
    if (fs !== null) fontSizes.push(fs);
    const lh = st["line-height"]?.trim();
    if (lh && lh !== "normal") {
      const n = parseFloat(lh);
      if (!Number.isNaN(n)) lineHeights.push(n);
    }
    const sh = st["box-shadow"];
    if (sh && sh !== "none") shadowHits++;
  }

  const medR = median(radii);
  const medFs = median(fontSizes);
  const medLh = median(lineHeights);

  const tagFreq = new TagFreq(outline.map((o) => o.tagName));
  const maxDepth = outline.reduce((m, o) => Math.max(m, o.depth), 0);

  const spacingSem = metaF.spacingSemantics as Record<string, unknown> | undefined;
  const scaleGuess = metaF.scaleGuess ?? spacingSem?.scaleGuess;
  const gridPx = metaF.gridStepGuessPx;

  const lines: string[] = [];
  lines.push(`# Prompt de referência do design (heurístico)`);
  lines.push(``);
  lines.push(`Este relatório resume **padrões observados automaticamente** no estado renderizado da página; não substitui auditoria humana nem intenção declarada pela marca.`);
  lines.push(``);
  if (url) {
    lines.push(`**URL analisada:** ${url}`);
    lines.push(``);
  }

  lines.push(`## Estética e layout`);
  if (medR !== null) {
    lines.push(`- **Cantos / raio:** mediana observada de \`border-radius\` ~ **${medR.toFixed(1)}px** ${medR < 1 ? "(perfil muito “flat”)" : ""}.`);
  } else {
    lines.push(`- **Cantos / raio:** poucas amostras de raio nas folhas analisadas.`);
  }
  lines.push(
    `- **Sombras:** em ~${samples.length ? Math.round((shadowHits / samples.length) * 100) : 0}% das amostras há \`box-shadow\` não trivial (ordem de grandeza).`
  );
  lines.push(
    `- **Árvore DOM (parcial, até limite do scan):** profundidade máxima ~**${maxDepth}**; tags mais frequentes: ${tagFreq.top(5).join(", ") || "—"}.`
  );
  lines.push(``);

  lines.push(`## Tipografia`);
  if (medFs !== null) {
    lines.push(`- **Tamanho de fonte (mediana nas amostras):** ~**${medFs.toFixed(1)}px**.`);
  }
  if (medLh !== null) {
    lines.push(`- **Line-height numérico (mediana onde aplicável):** ~**${medLh.toFixed(2)}**.`);
  }
  lines.push(`- Sugestão para prompts de UI: mencionar **legibilidade** e hierarquia por contraste de tamanho, sem assumir escala tipográfica nomeada.`);
  lines.push(``);

  lines.push(`## Espaçamento e escala`);
  if (scaleGuess) {
    lines.push(`- **Escala sugerida (heurística):** **${String(scaleGuess)}** (comparação de divisibilidade por 4px vs 8px nos valores mais frequentes).`);
  }
  if (gridPx !== undefined && gridPx !== null) {
    lines.push(`- **Passo de grelha inferido (delta mais comum entre valores ordenados):** ~**${gridPx}px** — valor indicativo.`);
  }
  lines.push(`- Para Tailwind-like tokens: prefira descrever **ritmo vertical** e **grelha de 4/8px** em texto; use \`dimension.suggested\` no JSON como ponto de partida, não verdade absoluta.`);
  lines.push(``);

  lines.push(`## Cor`);
  const colorLeaves = collectColorHints(f);
  if (colorLeaves.length) {
    lines.push(`- **Clusters de cor (centroides):** ${colorLeaves.slice(0, 6).join(", ")}.`);
    lines.push(`- Narrativa possível: estrutura **monocromática com acentos** se observar um cluster raro de alta saturação — validar visualmente.`);
  } else {
    lines.push(`- Pouca informação agregada de cor no \`final\`.`);
  }
  lines.push(``);

  lines.push(`## Movimento e micro-interações`);
  if (micro.length) {
    const durs = new Set<string>();
    for (const m of micro) {
      const h = m.hovered?.transitionDuration ?? m.idle?.transitionDuration;
      if (h) durs.add(h);
    }
    lines.push(`- **Probes de hover (Playwright):** ${micro.length} elementos amostrados; durações \`transition\` observadas (após hover): ${[...durs].slice(0, 8).join("; ") || "—"}.`);
    lines.push(`- Use isto para pedir **transições curtas** ou **ease** explícitos num redesign, citando os valores como referência.`);
  } else {
    lines.push(`- Sem probes de hover registados (ou página sem interativos visíveis no limite do scan).`);
  }
  lines.push(``);

  lines.push(`## Como usar no Cursor / Claude`);
  lines.push(`Copie o parágrafo seguinte como “contexto de estilo”:`);
  lines.push(``);
  lines.push(
    `> Site observado${url ? ` (${url})` : ""}: estética ${medR !== null && medR < 4 ? "minimalista com cantos subtis" : "com cantos moderados"}, tipografia com mediana ~${medFs?.toFixed(0) ?? "?"}px${medLh ? ` e line-height ~${medLh.toFixed(2)}` : ""}. Espaçamento compatível com escala **${String(scaleGuess ?? "mista")}**. Micro-interações: transições ${micro.length ? "amostradas por hover" : "não caracterizadas no scan"}. Pedir um frontend SaaS-premium coerente com estes constrangimentos e tokens exportados.`
  );

  return lines.join("\n");
}

function collectColorHints(final: Record<string, unknown>): string[] {
  const out: string[] = [];
  const color = final.color as Record<string, unknown> | undefined;
  if (!color) return out;
  const sem = color.semantic as Record<string, unknown> | undefined;
  if (!sem) return out;
  for (const v of Object.values(sem)) {
    const leaf = v as { $value?: string };
    if (leaf && typeof leaf.$value === "string") out.push(leaf.$value);
  }
  return out;
}

class TagFreq {
  private m = new Map<string, number>();
  constructor(keys: string[]) {
    for (const k of keys) this.m.set(k, (this.m.get(k) ?? 0) + 1);
  }
  top(n: number): string[] {
    return [...this.m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k]) => k);
  }
}
