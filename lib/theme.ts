/**
 * Runtime colour tokens for use in inline `style={{}}` props where Tailwind
 * classes are not available.  For class-based usage, the tokens resolve
 * automatically via CSS variables (see global.css + tailwind.config.js).
 */
import { useTheme } from "@/lib/themeContext";

const COLORS = {
  light: {
    bg:          "#FAFAF7",
    card:        "#FFFFFF",
    muted:       "#F1F1EC",
    border:      "#E6E5DF",
    borderSoft:  "#EFEEE9",
    ink:         "#1A1A17",
    inkSoft:     "#5B5B53",
    inkFaint:    "#9A9A91",
    // Elements that stay dark in both modes (FABs, action / selection bars)
    elevated:    "#1A1A17",
  },
  dark: {
    bg:          "#111110",
    card:        "#1C1C19",
    muted:       "#252522",
    border:      "#373735",
    borderSoft:  "#2D2D2A",
    ink:         "#F0F0EC",
    inkSoft:     "#9A9A91",
    inkFaint:    "#5A5A52",
    elevated:    "#2C2C29",
  },
};

export type ThemeColors = {
  bg: string; card: string; muted: string; border: string; borderSoft: string;
  ink: string; inkSoft: string; inkFaint: string; elevated: string;
};

export function useThemeColors(): ThemeColors {
  const { isDark } = useTheme();
  return isDark ? COLORS.dark : COLORS.light;
}
