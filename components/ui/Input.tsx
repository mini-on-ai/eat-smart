import { forwardRef } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, className, ...rest },
  ref,
) {
  return (
    <View className="gap-1.5">
      {label ? <Text className="text-sm font-medium text-ink-soft">{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#9A9A91"
        className={`h-12 rounded-2xl border border-border bg-card px-4 text-base text-ink ${error ? "border-urgent" : ""} ${className ?? ""}`}
        {...rest}
      />
      {error ? <Text className="text-xs text-urgent">{error}</Text> : null}
    </View>
  );
});
