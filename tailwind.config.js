/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Surface / background
        bg: "#FAFAF7",
        card: "#FFFFFF",
        muted: "#F1F1EC",
        border: "#E6E5DF",

        // Text
        ink: "#1A1A17",
        "ink-soft": "#5B5B53",
        "ink-faint": "#9A9A91",

        // Brand — warm green for fresh/food
        brand: {
          DEFAULT: "#3F8F5C",
          soft: "#E8F2EB",
          deep: "#2C6B43",
          dark: "#327049",
        },

        // Expiry urgency
        fresh: "#3F8F5C",       // > 7 days
        soon: "#D9A441",        // 1-3 days
        urgent: "#C8553D",      // today / expired
        urgentTint: "#FBE9E5",
        soonTint:   "#FAEFD8",
        borderSoft: "#EFEEE9",
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
