/** Colors come from CSS variables in src/styles/tokens.css (copied from the prototype). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Manrope", "system-ui", "sans-serif"] },
      colors: {
        bg: "var(--bg)", surface: "var(--surface)", "surface-2": "var(--surface-2)", "surface-3": "var(--surface-3)",
        panel: "var(--panel)", line: "var(--line)", "line-strong": "var(--line-strong)",
        text: "var(--text)", "text-2": "var(--text-2)", muted: "var(--muted)",
        primary: "var(--primary-bg)", "on-primary": "var(--primary-text)",
        ok: "var(--ok)", warn: "var(--warn-text)", "warn-bg": "var(--warn-bg)", "warn-line": "var(--warn-line)",
        field: "var(--field)", rail: "var(--rail-bg)",
      },
      boxShadow: { card: "var(--shadow)" },
    },
  },
  plugins: [],
};
