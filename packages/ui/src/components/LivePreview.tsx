import type { CSSProperties } from "react";
import { useMemo } from "react";
import { flattenDtcgForSd } from "@ds-extractor/style-export";

function cssVarFromPath(path: string): string {
  return `var(--${path.split(".").join("-")})`;
}

export function LivePreview({ tokens }: { tokens: unknown }) {
  const refs = useMemo(() => {
    const flat = flattenDtcgForSd(tokens);
    const colors = Object.entries(flat)
      .filter(([, v]) => v.type === "color")
      .map(([k]) => k);
    const dims = Object.entries(flat)
      .filter(([, v]) => v.type === "dimension")
      .map(([k]) => k);
    const fonts = Object.entries(flat)
      .filter(([, v]) => v.type === "fontFamily")
      .map(([k]) => k);
    const radius = dims[0] ?? colors[0];
    return {
      bg: colors[0],
      fg: colors[1] ?? colors[0],
      accent: colors[2] ?? colors[0],
      pad: dims[0],
      gap: dims[1] ?? dims[0],
      font: fonts[0],
      radius,
    };
  }, [tokens]);

  const styleCard: CSSProperties = {
    fontFamily: refs.font ? cssVarFromPath(refs.font) : undefined,
    backgroundColor: refs.bg ? cssVarFromPath(refs.bg) : "rgb(24 24 27)",
    color: refs.fg ? cssVarFromPath(refs.fg) : "#fafafa",
    padding: refs.pad ? cssVarFromPath(refs.pad) : "1rem",
    borderRadius: refs.radius ? cssVarFromPath(refs.radius) : "8px",
    boxShadow: "0 1px 2px rgb(0 0 0 / 0.2)",
    maxWidth: 420,
  };

  const btnStyle: CSSProperties = {
    backgroundColor: refs.accent ? cssVarFromPath(refs.accent) : "#3b82f6",
    color: refs.fg ? cssVarFromPath(refs.fg) : "#fff",
    padding: refs.pad ? cssVarFromPath(refs.pad) : "0.5rem 1rem",
    border: "none",
    borderRadius: refs.radius ? cssVarFromPath(refs.radius) : "6px",
    cursor: "pointer",
    fontWeight: 600,
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: refs.pad ? cssVarFromPath(refs.pad) : "0.5rem",
    borderRadius: refs.radius ? cssVarFromPath(refs.radius) : "6px",
    border: "1px solid rgb(63 63 70)",
    backgroundColor: "rgb(39 39 42)",
    color: refs.fg ? cssVarFromPath(refs.fg) : "inherit",
    marginTop: refs.gap ? cssVarFromPath(refs.gap) : "0.75rem",
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Componentes usando variáveis CSS geradas a partir dos tokens carregados (primeiras cores, espaços e fontes
        detectadas).
      </p>
      <div style={styleCard}>
        <div className="text-sm opacity-90">Card</div>
        <input style={inputStyle} placeholder="Input" aria-label="Preview input" />
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
          <button type="button" style={btnStyle}>
            Primário
          </button>
          <button
            type="button"
            style={{
              ...btnStyle,
              backgroundColor: "transparent",
              border: refs.accent ? `1px solid ${cssVarFromPath(refs.accent)}` : "1px solid #71717a",
            }}
          >
            Secundário
          </button>
        </div>
      </div>
    </div>
  );
}
