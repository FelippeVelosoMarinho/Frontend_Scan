import { flattenDtcgForSd, nestFlatTokensForStyleDictionary } from "./flatten.js";

export type StylesBundle = {
  themeCss: string;
  tailwindConfigJs: string;
  tokensJson: string;
  nestedTokens: Record<string, unknown>;
};

/** Gera artefatos equivalentes ao pipeline Style Dictionary (uso em browser ou Node sem gravar disco). */
export function generateStylesBundleFromDtcg(dtcgRoot: unknown): StylesBundle {
  const flat = flattenDtcgForSd(dtcgRoot);
  const nestedTokens = nestFlatTokensForStyleDictionary(flat);
  return {
    themeCss: themeCssFromFlat(flat),
    tailwindConfigJs: tailwindStubFromFlat(flat),
    tokensJson: JSON.stringify(nestedTokens, null, 2),
    nestedTokens,
  };
}

function themeCssFromFlat(flat: Record<string, { value: unknown; type?: string }>): string {
  const lines = Object.entries(flat).map(([pathStr, leaf]) => {
    const name = `--${pathStr.split(".").join("-")}`;
    const v = leaf.value;
    if (typeof v === "string") return `  ${name}: ${v};`;
    if (Array.isArray(v)) return `  ${name}: ${v.join(", ")};`;
    return `  ${name}: ${JSON.stringify(v)};`;
  });
  return `:root {\n${lines.join("\n")}\n}\n`;
}

function tailwindStubFromFlat(flat: Record<string, { value: unknown; type?: string }>): string {
  const spacing: Record<string, string> = {};
  const colors: Record<string, string> = {};

  for (const [pathStr, leaf] of Object.entries(flat)) {
    const p = pathStr.split(".").join("-");
    if (leaf.type === "dimension" && typeof leaf.value === "string") {
      spacing[p] = leaf.value;
    }
    if (leaf.type === "color" && typeof leaf.value === "string") {
      colors[p] = leaf.value;
    }
  }

  return `/** Gerado por DS-Extractor — ajuste theme.extend conforme necessário */
module.exports = {
  theme: {
    extend: {
      spacing: ${JSON.stringify(spacing, null, 2)},
      colors: ${JSON.stringify(colors, null, 2)},
    },
  },
};
`;
}
