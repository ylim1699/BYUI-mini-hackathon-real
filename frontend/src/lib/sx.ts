import type { CSSProperties } from "react";

// Lets components use the prototype's CSS strings as-is: sx("display: flex; gap: 8px;").
// Keeps the real app pixel-matched to the approved prototype.
const cache = new Map<string, CSSProperties>();

const camel = (prop: string): string => {
  if (prop.startsWith("--")) return prop; // CSS variables stay as-is
  const p = prop.startsWith("-webkit-") ? "Webkit-" + prop.slice(8) : prop;
  return p.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
};

export function sx(css: string): CSSProperties {
  const hit = cache.get(css);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (k && v) out[camel(k)] = v;
  }
  if (cache.size > 4000) cache.clear();
  cache.set(css, out as CSSProperties);
  return out as CSSProperties;
}
