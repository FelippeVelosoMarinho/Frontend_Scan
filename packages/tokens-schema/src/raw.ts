import { z } from "zod";

export const rawMetaSchema = z.object({
  url: z.string().url(),
  scannedAt: z.string(),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }),
  userAgent: z.string().optional(),
  maxElements: z.number().optional(),
});

export type RawMeta = z.infer<typeof rawMetaSchema>;

export const computedSampleSchema = z.object({
  path: z.string(),
  tagName: z.string(),
  role: z.string().optional(),
  ariaLabel: z.string().optional(),
  bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  styles: z.record(z.string()),
});

export type ComputedSample = z.infer<typeof computedSampleSchema>;

export const keyframeRuleSchema = z.object({
  name: z.string(),
  cssText: z.string(),
});

export const stylesheetArtifactsSchema = z.object({
  keyframes: z.array(keyframeRuleSchema),
  easings: z.array(z.string()),
  errors: z.array(z.object({ message: z.string(), href: z.string().optional() })),
});

export type StylesheetArtifacts = z.infer<typeof stylesheetArtifactsSchema>;

export const fontFaceEntrySchema = z.object({
  family: z.string().optional(),
  srcUrls: z.array(z.string()),
  weight: z.string().optional(),
  style: z.string().optional(),
});

export type FontFaceEntry = z.infer<typeof fontFaceEntrySchema>;

export const rawTokensSchema = z.object({
  $schema: z.string().optional(),
  meta: rawMetaSchema,
  computedSamples: z.array(computedSampleSchema),
  numericSpacing: z.array(z.number()),
  colors: z.array(z.string()),
  stylesheetArtifacts: stylesheetArtifactsSchema,
  fontFaces: z.array(fontFaceEntrySchema),
});

export type RawTokens = z.infer<typeof rawTokensSchema>;
