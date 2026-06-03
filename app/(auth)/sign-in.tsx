import { zodResolver } from "@hookform/resolvers/zod";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

function BrandMark() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path d="M5 19c0-7 5-13 14-13 0 9-7 14-14 14z" fill="white" opacity={0.95} />
      <Path d="M5 19l9-9" stroke="#3F8F5C" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

const schema = z.object({ email: z.string().email("Adresse e-mail invalide") });
type FormData = z.infer<typeof schema>;

export default function SignIn() {
  const router = useRouter();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: FormData) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: Linking.createURL("/") },
    });
    if (error) {
      setError("email", { message: error.message });
      return;
    }
    router.push({ pathname: "/(auth)/verify", params: { email } });
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 px-7 pt-14"
      >
        {/* BrandMark logo */}
        <View
          className="w-14 h-14 rounded-[18px] bg-brand items-center justify-center"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <BrandMark />
        </View>

        <Text
          className="text-[32px] font-semibold text-ink mt-9"
          style={{ letterSpacing: -0.64 }}
        >
          Bienvenue.
        </Text>
        <Text className="text-[15px] text-ink-soft leading-relaxed mt-3 mb-9" style={{ maxWidth: 300 }}>
          Suivez les dates de péremption de votre garde-manger en toute simplicité.
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Adresse e-mail"
              placeholder="ton@email.fr"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
            />
          )}
        />
        <Text className="text-xs text-ink-faint mt-2">
          Pas de mot de passe — un code à 8 chiffres par e-mail.
        </Text>

        <View className="flex-1" />

        <Button
          label="Continuer"
          loading={isSubmitting}
          onPress={handleSubmit(onSubmit)}
        />
        <Text className="text-xs text-ink-faint text-center mt-4 mb-2">
          En continuant, tu acceptes nos conditions.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
