import { describe, expect, it } from "vitest";
import { flattenDtcgForSd, nestFlatTokensForStyleDictionary } from "./flatten.js";

describe("flattenDtcgForSd", () => {
  it("achata folhas DTCG", () => {
    const input = {
      color: { semantic: { c0: { $type: "color", $value: "#000000" } } },
    };
    const flat = flattenDtcgForSd(input);
    expect(flat["color.semantic.c0"]).toEqual({ value: "#000000", type: "color" });
  });

  it("aninha para Style Dictionary", () => {
    const flat = flattenDtcgForSd({
      dimension: { scale: { s: { $type: "dimension", $value: "8px" } } },
    });
    const nested = nestFlatTokensForStyleDictionary(flat);
    expect((nested.dimension as Record<string, unknown>).scale).toEqual({
      s: { value: "8px", type: "dimension" },
    });
  });
});
