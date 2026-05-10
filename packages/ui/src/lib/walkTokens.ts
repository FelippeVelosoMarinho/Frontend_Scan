export type DtcgLeafLoose = {
  $type: string;
  $value: unknown;
  $description?: string;
};

export function isLeaf(v: unknown): v is DtcgLeafLoose {
  return (
    !!v &&
    typeof v === "object" &&
    "$type" in v &&
    "$value" in v &&
    typeof (v as DtcgLeafLoose).$type === "string"
  );
}

/** Lista folhas com caminho tipo `semantic.c0`. */
export function collectLeaves(obj: unknown, prefix: string[] = []): Array<{ path: string; leaf: DtcgLeafLoose }> {
  const out: Array<{ path: string; leaf: DtcgLeafLoose }> = [];
  if (!obj || typeof obj !== "object") return out;

  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (key === "$schema") continue;
    if (key === "meta" && prefix.length === 0) continue;

    if (isLeaf(val)) {
      out.push({ path: [...prefix, key].join("."), leaf: val });
    } else if (val && typeof val === "object") {
      out.push(...collectLeaves(val, [...prefix, key]));
    }
  }
  return out;
}

export function groupLeavesByTopCategory(
  leaves: Array<{ path: string; leaf: DtcgLeafLoose }>
): Record<string, Array<{ path: string; leaf: DtcgLeafLoose }>> {
  const g: Record<string, Array<{ path: string; leaf: DtcgLeafLoose }>> = {};
  for (const item of leaves) {
    const top = item.path.split(".")[0] ?? "misc";
    if (!g[top]) g[top] = [];
    g[top].push(item);
  }
  return g;
}
