import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0e17",
        panel: "#111827",
        "panel-2": "#161e2e",
        edge: "#232d42",
        fog: "#8b97ab",
        mint: "#34d399",
        sky: "#22d3ee",
        gold: "#d4af37",
        amber: "#fbbf24"
      },
      fontFamily: {
        serif: ["Georgia", "Times New Roman", "serif"]
      }
    }
  },
  plugins: []
};

export default config;
