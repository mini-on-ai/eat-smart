import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "ghost";

type Props = Omit<PressableProps, "children"> & {
  label: string;
  loading?: boolean;
  variant?: Variant;
};

const base = "h-12 rounded-2xl px-5 items-center justify-center active:opacity-80";

const variants: Record<Variant, { bg: string; text: string }> = {
  primary: { bg: "bg-brand", text: "text-white" },
  secondary: { bg: "bg-muted", text: "text-ink" },
  ghost: { bg: "bg-transparent", text: "text-brand" },
};

export function Button({ label, loading, variant = "primary", disabled, ...rest }: Props) {
  const v = variants[variant];
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      className={`${base} ${v.bg} ${disabled || loading ? "opacity-50" : ""}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "white" : "#1A1A17"} />
      ) : (
        <Text className={`text-base font-semibold ${v.text}`}>{label}</Text>
      )}
    </Pressable>
  );
}
