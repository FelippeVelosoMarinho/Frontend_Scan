/** Achata árvore DTCG em mapa plano path → value/type */
export function flattenDtcgForSd(
  obj: unknown,
  prefix: string[] = []
): Record<string, { value: unknown; type?: string }> {
  const out: Record<string, { value: unknown; type?: string }> = {};
  if (!obj || typeof obj !== "object") return out;

  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (key === "$schema") continue;
    if (key === "meta" && prefix.length === 0) continue;

    if (
      val &&
      typeof val === "object" &&
      "$value" in (val as Record<string, unknown>) &&
      "$type" in (val as Record<string, unknown>)
    ) {
      const leaf = val as { $value: unknown; $type: string };
      const name = [...prefix, key].join(".");
      out[name] = { value: leaf.$value, type: leaf.$type };
    } else if (val && typeof val === "object") {
      Object.assign(out, flattenDtcgForSd(val, [...prefix, key]));
    }
  }
  return out;
}

/** Converte mapa plano em árvore aninhada com folhas { value, type } (entrada Style Dictionary). */
export function nestFlatTokensForStyleDictionary(
  flat: Record<string, { value: unknown; type?: string }>
): Record<string, unknown> {
  const sdTokens: Record<string, unknown> = {};
  for (const [pathStr, { value, type }] of Object.entries(flat)) {
    const parts = pathStr.split(".");
    let cursor: Record<string, unknown> = sdTokens;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!cursor[p]) cursor[p] = {};
      cursor = cursor[p] as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1];
    cursor[leaf] = { value, type };
  }
  return sdTokens;
}
