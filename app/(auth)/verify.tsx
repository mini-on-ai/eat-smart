import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";

import { supabase } from "@/lib/supabase";

export default function Verify() {
  const params = useLocalSearchParams<{ email: string }>();
  const email = decodeURIComponent(params.email ?? "");
  const router = useRouter();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(45);
  const hiddenInputRef = useRef<TextInput>(null);

  // Cursor blink animation
  const blinkAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Auto-submit when 8 chars filled
  useEffect(() => {
    if (code.length === 8) {
      verifyCode(code);
    }
  }, [code]);

  async function verifyCode(token: string) {
    setError(null);
    for (const type of ["signup", "magiclink", "email"] as const) {
      const { error: err } = await supabase.auth.verifyOtp({ email, token, type });
      if (!err) return;
    }
    setError("Code incorrect ou expiré — demandez un nouveau code.");
    setCode("");
  }

  async function resendCode() {
    await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setResendIn(45);
  }

  const focusedIdx = code.length < 8 ? code.length : -1;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {/* Back button */}
        <View className="px-2 pt-2">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-60"
          >
            <ChevronLeft size={24} color="#1A1A17" strokeWidth={1.75} />
          </Pressable>
        </View>

        <View className="flex-1 px-7">
          <Text
            className="text-2xl font-semibold text-ink mt-5"
            style={{ letterSpacing: -0.5 }}
          >
            Vérifie tes e-mails
          </Text>
          <Text className="text-[15px] text-ink-soft mt-3">
            Code envoyé à{" "}
            <Text className="text-ink font-semibold">{email}</Text>
          </Text>

          {/* 8-cell code input */}
          <View className="flex-row gap-1.5 mt-8">
            {Array(8)
              .fill(0)
              .map((_, i) => {
                const char = code[i] ?? "";
                const isFocused = i === focusedIdx;
                return (
                  <Pressable
                    key={i}
                    onPress={() => hiddenInputRef.current?.focus()}
                    className="flex-1 h-14 rounded-xl bg-card items-center justify-center"
                    style={{
                      borderWidth: 1.5,
                      borderColor: isFocused ? "#3F8F5C" : "#E6E5DF",
                      ...(isFocused
                        ? {
                            shadowColor: "#3F8F5C",
                            shadowOpacity: 0.18,
                            shadowRadius: 4,
                            shadowOffset: { width: 0, height: 0 },
                            elevation: 2,
                          }
                        : {}),
                    }}
                  >
                    {char ? (
                      <Text
                        className="text-[22px] font-semibold text-ink"
                        style={{ letterSpacing: -0.5 }}
                      >
                        {char}
                      </Text>
                    ) : isFocused ? (
                      <Animated.View
                        style={{
                          width: 2,
                          height: 24,
                          backgroundColor: "#3F8F5C",
                          borderRadius: 1,
                          opacity: blinkAnim,
                        }}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
          </View>

          {/* Hidden text input */}
          <TextInput
            ref={hiddenInputRef}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 8))}
            keyboardType="number-pad"
            maxLength={8}
            autoFocus
            autoComplete="one-time-code"
            style={{ position: "absolute", opacity: 0, height: 0, width: 0 }}
          />

          {/* Error */}
          {error ? (
            <Text className="text-xs text-urgent mt-4">{error}</Text>
          ) : null}

          {/* Resend */}
          <View className="mt-8 items-center">
            {resendIn > 0 ? (
              <Text className="text-[13px] font-medium text-ink-faint">
                Renvoyer dans 0:{String(resendIn).padStart(2, "0")}
              </Text>
            ) : (
              <Pressable onPress={resendCode} className="active:opacity-60">
                <Text className="text-[13px] font-semibold text-brand">
                  Renvoyer le code
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
