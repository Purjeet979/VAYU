import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        panel: "var(--panel)",
        panelBorder: "var(--panel-border)",
        cyan: "#00f0ff",
        brandOrange: "#ff8a00",
        brandYellow: "#facc15",
        brandGreen: "#4ade80",
        brandRed: "#f87171",
      },
    },
  },
  plugins: [],
};
export default config;
