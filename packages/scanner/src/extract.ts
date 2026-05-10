import type { Browser } from "playwright";
import { chromium } from "playwright";
import { rawTokensSchema, type RawTokens } from "@ds-extractor/tokens-schema";
import { normalizeColorToHex } from "./colors.js";

export type ExtractOptions = {
  url: string;
  maxElements?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  navigationTimeoutMs?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
};

const DEFAULT_MAX = 800;

/** Serialized payload from `page.evaluate` (browser context). */
type PagePayload = {
  computedSamples: RawTokens["computedSamples"];
  numericSpacing: number[];
  colorSamples: string[];
  stylesheetArtifacts: RawTokens["stylesheetArtifacts"];
  fontFaces: RawTokens["fontFaces"];
};

export async function extractWithBrowser(
  browser: Browser,
  options: ExtractOptions
): Promise<RawTokens> {
  const {
    url,
    maxElements = DEFAULT_MAX,
    viewportWidth = 1280,
    viewportHeight = 800,
    navigationTimeoutMs = 60000,
    waitUntil = "networkidle",
  } = options;

  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
  });
  const page = await context.newPage();

  try {
    await page.goto(url, {
      waitUntil,
      timeout: navigationTimeoutMs,
    });

    const payload = await page.evaluate(runDomScan, { maxElements });

    const meta = {
      url,
      scannedAt: new Date().toISOString(),
      viewport: { width: viewportWidth, height: viewportHeight },
      userAgent: await page.evaluate(() => navigator.userAgent),
      maxElements,
    };

    const colorsFromStyles = new Set<string>();
    for (const sample of payload.computedSamples) {
      for (const key of Object.keys(sample.styles)) {
        if (!key.includes("color") && key !== "fill" && key !== "stroke") continue;
        const hex = normalizeColorToHex(sample.styles[key]);
        if (hex) colorsFromStyles.add(hex);
      }
    }
    for (const c of payload.colorSamples) {
      const hex = normalizeColorToHex(c);
      if (hex) colorsFromStyles.add(hex);
    }

    const numericSpacing = [
      ...new Set(payload.numericSpacing.map((n) => Math.round(n * 1000) / 1000)),
    ].sort((a, b) => a - b);

    const raw: RawTokens = {
      meta,
      computedSamples: payload.computedSamples,
      numericSpacing,
      colors: [...colorsFromStyles].sort(),
      stylesheetArtifacts: payload.stylesheetArtifacts,
      fontFaces: payload.fontFaces,
    };

    return rawTokensSchema.parse(raw);
  } finally {
    await context.close();
  }
}

export async function extractToRawTokens(options: ExtractOptions): Promise<RawTokens> {
  const browser = await chromium.launch({ headless: true });
  try {
    return await extractWithBrowser(browser, options);
  } finally {
    await browser.close();
  }
}

function runDomScan(args: { maxElements: number }): PagePayload {
  const { maxElements } = args;

  const STYLE_KEYS = [
    "color",
    "background-color",
    "border-color",
    "outline-color",
    "fill",
    "stroke",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-transform",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "gap",
    "row-gap",
    "column-gap",
    "border-radius",
    "box-shadow",
    "width",
    "max-width",
    "transition-timing-function",
    "animation-timing-function",
  ];

  const computedSamples: PagePayload["computedSamples"] = [];
  const numericSpacing: number[] = [];
  const colorSamples: string[] = [];
  const easingsSet = new Set<string>();

  function parsePx(val: string | null): number | null {
    if (!val) return null;
    const m = /^([\d.]+)px$/.exec(val.trim());
    return m ? parseFloat(m[1]) : null;
  }

  function pushSpacingFromStyle(cs: CSSStyleDeclaration): void {
    const keys = [
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "gap",
      "row-gap",
      "column-gap",
      "font-size",
      "border-radius",
      "width",
      "max-width",
    ];
    for (const k of keys) {
      const px = parsePx(cs.getPropertyValue(k));
      if (px !== null && px >= 0 && px < 4096) numericSpacing.push(px);
    }
  }

  function pushColorsFromStyle(cs: CSSStyleDeclaration): void {
    const keys = ["color", "background-color", "border-color", "outline-color", "fill", "stroke"];
    for (const k of keys) {
      colorSamples.push(cs.getPropertyValue(k));
    }
  }

  function elementPath(el: Element): string {
    const parts: string[] = [];
    let cur: Element | null = el;
    while (cur && cur.nodeType === Node.ELEMENT_NODE) {
      const parentEl: Element | null = cur.parentElement;
      if (!parentEl) {
        parts.unshift(cur.tagName.toLowerCase());
        break;
      }
      const idx = Array.from(parentEl.children).indexOf(cur) + 1;
      parts.unshift(`${cur.tagName.toLowerCase()}:nth-child(${idx})`);
      cur = parentEl;
    }
    return parts.join(" > ");
  }

  function isVisible(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const cs = window.getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") {
      return false;
    }
    return true;
  }

  const all = document.querySelectorAll("*");
  let count = 0;
  for (let i = 0; i < all.length && count < maxElements; i++) {
    const el = all[i];
    if (!isVisible(el)) continue;
    count++;
    const cs = window.getComputedStyle(el);
    const styles: Record<string, string> = {};
    for (const key of STYLE_KEYS) {
      styles[key] = cs.getPropertyValue(key);
    }
    let bbox: PagePayload["computedSamples"][0]["bbox"];
    try {
      const r = el.getBoundingClientRect();
      bbox = { x: r.x, y: r.y, width: r.width, height: r.height };
    } catch {
      bbox = undefined;
    }

    computedSamples.push({
      path: elementPath(el),
      tagName: el.tagName.toLowerCase(),
      role: el.getAttribute("role") ?? undefined,
      ariaLabel: el.getAttribute("aria-label") ?? undefined,
      bbox,
      styles,
    });
    pushSpacingFromStyle(cs);
    pushColorsFromStyle(cs);
    const tt = cs.transitionTimingFunction;
    const at = cs.animationTimingFunction;
    if (tt) easingsSet.add(tt);
    if (at) easingsSet.add(at);
  }

  const keyframes: PagePayload["stylesheetArtifacts"]["keyframes"] = [];
  const errors: PagePayload["stylesheetArtifacts"]["errors"] = [];
  const fontFaces: PagePayload["fontFaces"] = [];

  function extractUrlsFromSrc(src: string): string[] {
    const urls: string[] = [];
    const re = /url\(([^)]+)\)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      let u = m[1].trim().replace(/^["']|["']$/g, "");
      urls.push(u);
    }
    return urls;
  }

  function pushEasingFromCssText(style: CSSStyleDeclaration): void {
    const tt = style.getPropertyValue("transition-timing-function");
    const at = style.getPropertyValue("animation-timing-function");
    if (tt) easingsSet.add(tt);
    if (at) easingsSet.add(at);
  }

  function walkRules(ruleList: CSSRuleList | undefined): void {
    if (!ruleList) return;
    for (let i = 0; i < ruleList.length; i++) {
      const rule = ruleList[i];
      const type = rule.type;
      if (type === CSSRule.KEYFRAMES_RULE) {
        const kr = rule as CSSKeyframesRule;
        keyframes.push({ name: kr.name, cssText: kr.cssText });
      } else if (type === CSSRule.FONT_FACE_RULE) {
        const ff = rule as CSSFontFaceRule;
        const style = ff.style;
        const family = style.getPropertyValue("font-family") || undefined;
        const src = style.getPropertyValue("src") || "";
        const weight = style.getPropertyValue("font-weight") || undefined;
        const fontStyle = style.getPropertyValue("font-style") || undefined;
        fontFaces.push({
          family,
          srcUrls: extractUrlsFromSrc(src),
          weight,
          style: fontStyle,
        });
      } else if (type === CSSRule.STYLE_RULE) {
        const sr = rule as CSSStyleRule;
        pushEasingFromCssText(sr.style);
      } else {
        const grp = rule as CSSGroupingRule & { cssRules?: CSSRuleList };
        if (grp.cssRules && grp.cssRules.length) {
          walkRules(grp.cssRules);
        }
      }
    }
  }

  for (let s = 0; s < document.styleSheets.length; s++) {
    const sheet = document.styleSheets[s];
    try {
      const rules = sheet.cssRules;
      walkRules(rules);
    } catch (e) {
      errors.push({
        message: e instanceof Error ? e.message : String(e),
        href: sheet.href ?? undefined,
      });
    }
  }

  const stylesheetArtifacts: PagePayload["stylesheetArtifacts"] = {
    keyframes,
    easings: [...easingsSet],
    errors,
  };

  return {
    computedSamples,
    numericSpacing,
    colorSamples,
    stylesheetArtifacts,
    fontFaces,
  };
}
