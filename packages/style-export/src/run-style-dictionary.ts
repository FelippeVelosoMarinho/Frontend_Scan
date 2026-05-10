import fs from "node:fs";
import path from "node:path";
import StyleDictionary from "style-dictionary";
import { flattenDtcgForSd, nestFlatTokensForStyleDictionary } from "./flatten.js";
import { registerDtcgFormats } from "./register-formats.js";

export async function runStyleDictionary(
  finalTokensPath: string,
  outputDir: string
): Promise<void> {
  registerDtcgFormats();

  const raw = JSON.parse(fs.readFileSync(finalTokensPath, "utf8"));
  const flat = flattenDtcgForSd(raw);
  const sdTokens = nestFlatTokensForStyleDictionary(flat);

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
