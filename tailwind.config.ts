import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1B2D5B",
          dark: "#0D1B36",
          mid: "#243B6E",
          light: "#E8EEF8",
          50: "#F0F3FA",
        },
        gold: {
          DEFAULT: "#C9A227",
          dark: "#A8891E",
          light: "#FDF4D6",
          50: "#FFFBF0",
        },
        brand: {
          DEFAULT: "#1B2D5B",
          dark: "#0D1B36",
          light: "#E8EEF8",
        },
      },
      fontFamily: {
        sans: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
      boxShadow: {
        gold: "0 4px 24px rgba(201,162,39,0.25)",
        navy: "0 4px 24px rgba(13,27,54,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
