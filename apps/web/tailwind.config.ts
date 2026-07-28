import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
        },
        line: "var(--line)",
        brass: {
          DEFAULT: "var(--brass)",
          strong: "var(--brass-strong)",
          soft: "var(--brass-soft)",
        },
        signal: "var(--signal)",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        sans: ['"Space Grotesk"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;