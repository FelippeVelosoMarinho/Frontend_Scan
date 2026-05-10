import StyleDictionary from "style-dictionary";

let registered = false;

export function registerDtcgFormats(): void {
  if (registered) return;
  registered = true;

  StyleDictionary.registerFormat({
    name: "css/dtcg-variables",
    format: ({ dictionary }) => {
      const lines = dictionary.allTokens.map((t) => {
        const name = `--${t.path.join("-")}`;
        const v = t.value;
        if (typeof v === "string") return `  ${name}: ${v};`;
        if (Array.isArray(v)) return `  ${name}: ${v.join(", ")};`;
        return `  ${name}: ${JSON.stringify(v)};`;
      });
      return `:root {\n${lines.join("\n")}\n}\n`;
    },
  });

  StyleDictionary.registerFormat({
    name: "javascript/tailwind-preset-stub",
    format: ({ dictionary }) => {
      const spacing: Record<string, string> = {};
      const colors: Record<string, string> = {};

      for (const t of dictionary.allTokens) {
        const p = t.path.join("-");
        if (t.type === "dimension" && typeof t.value === "string") {
          spacing[p] = t.value;
        }
        if (t.type === "color" && typeof t.value === "string") {
          colors[p] = t.value;
        }
      }

      return `/** Gerado por DS-Extractor / Style Dictionary — ajuste theme.extend conforme necessário */
module.exports = {
  theme: {
    extend: {
      spacing: ${JSON.stringify(spacing, null, 2)},
      colors: ${JSON.stringify(colors, null, 2)},
    },
  },
};
`;
    },
  });
}
