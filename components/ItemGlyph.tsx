import {
  Apple,
  Beef,
  Fish,
  Leaf,
  Milk,
  Package,
  ShoppingBag,
  Snowflake,
  Wheat,
  type LucideIcon,
} from "lucide-react-native";
import { View } from "react-native";

const ICON_MAP: Record<string, LucideIcon> = {
  Milk,
  Leaf,
  Apple,
  Beef,
  Fish,
  Wheat,
  Snowflake,
  Package,
  ShoppingBag,
};

type StyleDef = {
  keywords: string[];
  tint: string;
  icon: string;
  iconColor: string;
};

const STYLES: StyleDef[] = [
  {
    keywords: ["lait", "yaourt", "fromage", "crème", "beurre", "œuf", "oeuf"],
    tint: "#F4F1EA",
    iconColor: "#9C8F77",
    icon: "Milk",
  },
  {
    keywords: ["légume", "salade", "épinard", "poireau", "tomate", "carotte", "haricot"],
    tint: "#E8F2EB",
    iconColor: "#3F8F5C",
    icon: "Leaf",
  },
  {
    keywords: ["fruit", "pomme", "banane", "citron", "fraise", "poire", "orange"],
    tint: "#FBE9E5",
    iconColor: "#C8553D",
    icon: "Apple",
  },
  {
    keywords: ["viande", "poulet", "bœuf", "porc", "agneau", "steak"],
    tint: "#F7E6E0",
    iconColor: "#A04A36",
    icon: "Beef",
  },
  {
    keywords: ["poisson", "saumon", "thon", "cabillaud", "crevette"],
    tint: "#E5EEF2",
    iconColor: "#3A6F84",
    icon: "Fish",
  },
  {
    keywords: ["pain", "baguette", "brioche", "boulangerie", "céréale", "farine", "épicerie", "riz", "pâte", "pasta"],
    tint: "#FAEFD8",
    iconColor: "#A07A2C",
    icon: "Wheat",
  },
  {
    keywords: ["surgelé", "congelé"],
    tint: "#E5EEF7",
    iconColor: "#4A5FA0",
    icon: "Snowflake",
  },
  {
    keywords: ["conserve", "boîte"],
    tint: "#F0EFEA",
    iconColor: "#7A7568",
    icon: "Package",
  },
];

const DEFAULT_STYLE = {
  tint: "#F0EFEA",
  iconColor: "#7A7568",
  icon: "ShoppingBag",
};

function resolveStyle(categoryName?: string | null): typeof DEFAULT_STYLE {
  if (!categoryName) return DEFAULT_STYLE;
  const lower = categoryName.toLowerCase();
  for (const s of STYLES) {
    if (s.keywords.some((kw) => lower.includes(kw))) {
      return s;
    }
  }
  return DEFAULT_STYLE;
}

type Props = {
  categoryName?: string | null;
  size?: number;
};

export function ItemGlyph({ categoryName, size = 40 }: Props) {
  const { tint, iconColor, icon } = resolveStyle(categoryName);
  const IconComponent = ICON_MAP[icon] ?? ShoppingBag;
  const iconSize = Math.round(size * 0.5);
  const radius = Math.round(size / 3);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: tint,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <IconComponent size={iconSize} color={iconColor} strokeWidth={1.75} />
    </View>
  );
}
