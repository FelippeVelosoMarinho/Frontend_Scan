import { z } from "zod";

/** DTCG leaf token — https://design-tokens.github.io/community-group/format/ */
export const dtcgLeafSchema = z.discriminatedUnion("$type", [
  z.object({
    $type: z.literal("color"),
    $value: z.string(),
    $description: z.string().optional(),
  }),
  z.object({
    $type: z.literal("dimension"),
    $value: z.string(),
    $description: z.string().optional(),
  }),
  z.object({
    $type: z.literal("fontFamily"),
    $value: z.union([z.string(), z.array(z.string())]),
    $description: z.string().optional(),
  }),
  z.object({
    $type: z.literal("fontWeight"),
    $value: z.number(),
    $description: z.string().optional(),
  }),
  z.object({
    $type: z.literal("duration"),
    $value: z.string(),
    $description: z.string().optional(),
  }),
  z.object({
    $type: z.literal("cubicBezier"),
    $value: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    $description: z.string().optional(),
  }),
]);

export type DtcgLeaf = z.infer<typeof dtcgLeafSchema>;

/** Nested groups + leaves */
export type DtcgTokenTree = {
  [key: string]: DtcgLeaf | DtcgTokenTree;
};

export const finalMetaSchema = z.object({
  sourceUrl: z.string().optional(),
  clusterVersion: z.string().optional(),
  notes: z.string().optional(),
});

export type FinalMeta = z.infer<typeof finalMetaSchema>;

/** Root: known keys + passthrough for nested token groups (color, dimension, motion, …). */
export const finalTokensRootSchema = z
  .object({
    $schema: z.string().optional(),
    meta: finalMetaSchema.optional(),
  })
  .passthrough();

export type FinalTokens = z.infer<typeof finalTokensRootSchema> & {
  color?: DtcgTokenTree;
  dimension?: DtcgTokenTree;
  font?: DtcgTokenTree;
  motion?: DtcgTokenTree;
};
