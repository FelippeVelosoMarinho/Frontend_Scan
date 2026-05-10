/** Best-effort canonical hex for clustering (#rrggbb). */
export function normalizeColorToHex(input: string | undefined | null): string | null {
  if (!input || input === "transparent" || input === "inherit" || input === "initial") {
    return null;
  }
  const s = input.trim();
  const hex7 = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(s);
  if (hex7) {
    let h = hex7[1];
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return `#${h.toLowerCase()}`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(s);
  if (rgb) {
    const r = clamp255(Number(rgb[1]));
    const g = clamp255(Number(rgb[2]));
    const b = clamp255(Number(rgb[3]));
    const a = rgb[4] !== undefined ? Number(rgb[4]) : 1;
    if (a < 1) return null;
    return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  }
  return null;
}

function clamp255(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex2(n: number): string {
  return n.toString(16).padStart(2, "0");
}

export function dedupeSorted(arr: string[]): string[] {
  return [...new Set(arr)].sort();
}
