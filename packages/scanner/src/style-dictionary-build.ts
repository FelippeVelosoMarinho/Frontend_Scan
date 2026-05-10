import fs from "node:fs";
import path from "node:path";
import StyleDictionary from "style-dictionary";

/** Achata árvore DTCG em tokens Style Dictionary (caminnhos com pontos). */
function flattenDtcgForSd(
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

function registerDtcgFormats(): void {
  StyleDictionary.registerFormat({
    name: "css/dtcg-variables",
    format: ({ dictionary }) => {
      const lines = dictionary.allTokens.map((t) => {
        const name = `--${t.path.join("-")}`;
        let v = t.value;
        if (typeof v === "string") {
          return `  ${name}: ${v};`;
        }
        if (Array.isArray(v)) {
          return `  ${name}: ${v.join(", ")};`;
        }
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

export async function runStyleDictionary(
  finalTokensPath: string,
  outputDir: string
): Promise<void> {
  registerDtcgFormats();

  const raw = JSON.parse(fs.readFileSync(finalTokensPath, "utf8"));
  const flat = flattenDtcgForSd(raw);
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
    cursor[leaf] = {
      value,
      type,
    };
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const tmpTokensPath = path.join(outputDir, ".tokens-input.json");
  fs.writeFileSync(tmpTokensPath, JSON.stringify(sdTokens, null, 2), "utf8");

  const sd = new StyleDictionary({
    source: [tmpTokensPath],
    platforms: {
      css: {
        transformGroup: "css",
        buildPath: outputDir + path.sep,
        files: [
          {
            destination: "theme.css",
            format: "css/dtcg-variables",
          },
        ],
      },
      js: {
        transformGroup: "js",
        buildPath: outputDir + path.sep,
        files: [
          {
            destination: "tailwind.config.js",
            format: "javascript/tailwind-preset-stub",
          },
        ],
      },
      json: {
        transformGroup: "js",
        buildPath: outputDir + path.sep,
        files: [
          {
            destination: "tokens.json",
            format: "json/nested",
          },
        ],
      },
    },
  });

  await sd.buildAllPlatforms();
}
