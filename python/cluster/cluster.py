#!/usr/bin/env python3
"""Clusteriza cores do raw-tokens.json (K-Means) e emite final-tokens.json no formato DTCG."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from collections import Counter
from sklearn.cluster import KMeans


TW_SPACING_PX = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 112, 128]


def nearest_tailwind_spacing_px(px: float) -> int:
    return int(min(TW_SPACING_PX, key=lambda t: abs(t - px)))


def infer_scale_guess(vals: list[float]) -> str:
    """Heurística 4px vs 8px vs misto com base na divisibilidade dos valores observados."""
    clean = [round(v, 2) for v in vals if v > 0.25]
    if len(clean) < 3:
        return "mixed"
    mod4 = 0
    mod8 = 0
    for v in clean:
        r4 = abs(v % 4)
        r4 = min(r4, 4 - r4)
        r8 = abs(v % 8)
        r8 = min(r8, 8 - r8)
        if r4 < 0.6:
            mod4 += 1
        if r8 < 0.6:
            mod8 += 1
    n = len(clean)
    if mod8 / n >= 0.52:
        return "8"
    if mod4 / n >= 0.48:
        return "4"
    return "mixed"


def infer_grid_step(sorted_vals: list[float]) -> float | None:
    """Heurística: moda dos deltas entre valores de espaçamento ordenados (px)."""
    if len(sorted_vals) < 2:
        return None
    diffs: list[float] = []
    for i in range(len(sorted_vals) - 1):
        d = sorted_vals[i + 1] - sorted_vals[i]
        if d > 0.25:
            diffs.append(round(d, 2))
    if not diffs:
        return None
    return float(Counter(diffs).most_common(1)[0][0])


def hex_to_rgb(hex_color: str) -> tuple[float, float, float]:
    h = hex_color.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r = int(h[0:2], 16)
    g = int(h[2:4], 16)
    b = int(h[4:6], 16)
    return float(r), float(g), float(b)


def rgb_to_hex(r: float, g: float, b: float) -> str:
    return "#{:02x}{:02x}{:02x}".format(
        int(round(max(0, min(255, r)))),
        int(round(max(0, min(255, g)))),
        int(round(max(0, min(255, b)))),
    )


def parse_cubic_bezier(s: str) -> tuple[float, float, float, float] | None:
    m = re.search(
        r"cubic-bezier\s*\(\s*([-.\d]+)\s*,\s*([-.\d]+)\s*,\s*([-.\d]+)\s*,\s*([-.\d]+)\s*\)",
        s,
    )
    if not m:
        return None
    return tuple(float(x) for x in m.groups())  # type: ignore[return-value]


def main() -> int:
    ap = argparse.ArgumentParser(description="DS-Extractor color clustering")
    ap.add_argument("--in", dest="in_path", required=True, help="raw-tokens.json")
    ap.add_argument("--out", dest="out_path", required=True, help="final-tokens.json")
    args = ap.parse_args()

    raw_path = Path(args.in_path)
    out_path = Path(args.out_path)
    data = json.loads(raw_path.read_text(encoding="utf8"))

    meta_in = data.get("meta", {})
    source_url = meta_in.get("url", "")
    colors = data.get("colors") or []
    numeric_spacing = data.get("numericSpacing") or []
    artifacts = data.get("stylesheetArtifacts") or {}
    easings = artifacts.get("easings") or []
    font_faces = data.get("fontFaces") or []

    # --- K-Means em cores (RGB) ---
    color_groups: dict[str, dict] = {}
    if colors:
        rgb = np.array([hex_to_rgb(c) for c in colors])
        n = len(colors)
        k = min(8, n)
        k = max(1, k)
        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = km.fit_predict(rgb)
        centers = km.cluster_centers_

        df = pd.DataFrame({"hex": colors, "label": labels})
        for idx in range(k):
            centroid = rgb_to_hex(centers[idx][0], centers[idx][1], centers[idx][2])
            members = df[df["label"] == idx]["hex"].tolist()
            key = f"c{idx}"
            color_groups[key] = {
                "$type": "color",
                "$value": centroid,
                "$description": f"cluster {idx}, n={len(members)}",
            }

    # --- Espaçamentos como dimension tokens (top valores únicos) ---
    spacing_sorted = sorted(set(float(x) for x in numeric_spacing))[:24]
    scale_guess = infer_scale_guess(list(spacing_sorted))
    preferred_base = 8 if scale_guess == "8" else 4

    dimension_groups: dict[str, dict] = {}
    suggested_groups: dict[str, dict] = {}
    for i, px in enumerate(spacing_sorted):
        dimension_groups[f"space-{i}"] = {
            "$type": "dimension",
            "$value": f"{px:g}px",
        }
        tw_px = nearest_tailwind_spacing_px(px)
        snapped = round(px / preferred_base) * preferred_base
        suggested_groups[f"space-{i}"] = {
            "$type": "dimension",
            "$value": f"{tw_px}px",
            "$description": (
                f"observado ~{px:g}px → step Tailwind ~{tw_px}px; "
                f"snap {snapped:g}px (base sugerida {preferred_base}px; escala {scale_guess})"
            ),
        }

    # --- Easing (apenas cubic-bezier parseável) ---
    motion_easing: dict[str, dict] = {}
    for i, es in enumerate(easings):
        parsed = parse_cubic_bezier(es)
        if parsed:
            motion_easing[f"bezier-{i}"] = {
                "$type": "cubicBezier",
                "$value": list(parsed),
                "$description": es[:120],
            }

    # --- Font stacks observadas nas amostras (famílias únicas) ---
    font_family_tokens: dict[str, dict] = {}
    samples = data.get("computedSamples") or []
    fam_seen: set[str] = set()
    for s in samples:
        styles = s.get("styles") or {}
        ff = styles.get("font-family", "").strip()
        if not ff or ff in fam_seen:
            continue
        fam_seen.add(ff)
        key = f"family-{len(font_family_tokens)}"
        font_family_tokens[key] = {
            "$type": "fontFamily",
            "$value": ff.split(",")[0].strip().strip("'\""),
        }

    grid_guess = infer_grid_step(spacing_sorted)

    dimension_root: dict = {}
    if dimension_groups:
        dimension_root["scale"] = dimension_groups
    if suggested_groups:
        dimension_root["suggested"] = suggested_groups

    out_doc: dict = {
        "$schema": "https://tr.designtokens.org/format/",
        "meta": {
            "sourceUrl": source_url,
            "clusterVersion": "kmeans-sklearn-v1",
            "notes": "Cores via K-Means em RGB; espaçamentos de valores observados; easings parseados.",
            "gridStepGuessPx": grid_guess,
            "scaleGuess": scale_guess,
            "spacingSemantics": {
                "preferredBasePx": preferred_base,
                "scaleGuess": scale_guess,
                "hint": (
                    "Valores dimension.suggested aproximam steps ao estilo Tailwind; "
                    "ajuste manualmente para o seu preset."
                ),
            },
        },
        "color": {"semantic": color_groups} if color_groups else {},
        "dimension": dimension_root if dimension_root else {},
        "motion": {"easing": motion_easing} if motion_easing else {},
        "font": {"family": font_family_tokens} if font_family_tokens else {},
    }

    # Fontes @font-face (URLs como metadado textual — não são folhas DTCG puras)
    if font_faces:
        out_doc["meta"]["fontFaceSources"] = [
            {"family": f.get("family"), "urls": f.get("srcUrls", [])} for f in font_faces[:40]
        ]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out_doc, indent=2, ensure_ascii=False), encoding="utf8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
