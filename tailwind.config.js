/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        // Surface / background — resolved from CSS variables so dark mode
        // works automatically on both web (via media query) and native
        // (via vars() injection in _layout.tsx).
        bg:          "var(--color-bg)",
        card:        "var(--color-card)",
        muted:       "var(--color-muted)",
        border:      "var(--color-border)",
        borderSoft:  "var(--color-border-soft)",

        // Text
        ink:         "var(--color-ink)",
        "ink-soft":  "var(--color-ink-soft)",
        "ink-faint": "var(--color-ink-faint)",

        // Brand — warm green for fresh/food (unchanged across modes)
        brand: {
          DEFAULT: "#3F8F5C",
          soft: "#E8F2EB",
          deep: "#2C6B43",
          dark: "#327049",
        },

        // Expiry urgency (semantic — unchanged across modes)
        fresh:      "#3F8F5C",
        soon:       "#D9A441",
        urgent:     "#C8553D",
        urgentTint: "#FBE9E5",
        soonTint:   "#FAEFD8",
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
