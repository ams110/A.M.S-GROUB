import type { Config } from "tailwindcss";

/**
 * Â.M.Ŝ GROUP — "Gold & Onyx" luxury identity.
 *
 * The `navy` token name is kept for backwards-compat with existing markup,
 * but it now maps to a warm onyx/charcoal scale instead of blue. This lets the
 * whole app re-skin from one place: every `bg-navy*`, `text-navy*`, `border-navy*`
 * automatically inherits the new black-gold identity.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Onyx / charcoal (was "navy") — the dark chrome of the app
        navy: {
          DEFAULT: "#1C1A17", // warm charcoal — primary dark surfaces / text
          dark: "#0C0B0A", // near-black — headers, hero, splash
          mid: "#322D27", // hover / elevated dark
          light: "#EFEBE3", // warm cream tint
          50: "#FAF8F3", // app canvas (soft off-white)
        },
        // Refined gold — the signature accent
        gold: {
          DEFAULT: "#C9A227",
          dark: "#9C7C18",
          mid: "#E0BE45",
          light: "#FBF1CF",
          50: "#FDF9ED",
        },
        // Brand = readable bronze (text/price accents on light surfaces)
        brand: {
          DEFAULT: "#8A6D1F",
          dark: "#1C1A17",
          light: "#EFEBE3",
        },
        // Supporting accent for the "mix" — deep burgundy (gold + black + wine)
        wine: {
          DEFAULT: "#7C2D3A",
          dark: "#5A1F29",
          light: "#F6E7E9",
        },
      },
      fontFamily: {
        sans: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
      boxShadow: {
        gold: "0 4px 24px rgba(201,162,39,0.28)",
        "gold-lg": "0 10px 40px rgba(201,162,39,0.35)",
        navy: "0 4px 24px rgba(12,11,10,0.30)",
        onyx: "0 10px 40px rgba(12,11,10,0.45)",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #E0BE45 0%, #C9A227 50%, #9C7C18 100%)",
        "onyx-gradient": "linear-gradient(135deg, #0C0B0A 0%, #1C1A17 55%, #0C0B0A 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
