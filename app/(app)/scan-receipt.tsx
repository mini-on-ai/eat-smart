import { decode as decodeBase64, encode as encodeBase64 } from "base64-arraybuffer";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Zap, Image as ImageIcon, SlidersHorizontal, Sparkles } from "lucide-react-native";

import { useHousehold } from "@/lib/hooks/useHousehold";
import { supabase } from "@/lib/supabase";

const SCAN_STAGES = [
  "Lecture du ticket…",
  "Détection des articles…",
  "Estimation des dates…",
];

function CornerBrackets() {
  const corners: Array<{ v: "top" | "bottom"; h: "left" | "right" }> = [
    { v: "top", h: "left" },
    { v: "top", h: "right" },
    { v: "bottom", h: "left" },
    { v: "bottom", h: "right" },
  ];
  return (
    <>
      {corners.map(({ v, h }) => (
        <View
          key={v + h}
          style={{
            position: "absolute",
            [v]: 64,
            [h]: 36,
            width: 28,
            height: 28,
            borderTopWidth: v === "top" ? 3 : 0,
            borderBottomWidth: v === "bottom" ? 3 : 0,
            borderLeftWidth: h === "left" ? 3 : 0,
            borderRightWidth: h === "right" ? 3 : 0,
            borderColor: "#fff",
            borderRadius: 6,
          }}
        />
      ))}
    </>
  );
}

function ReceiptIllustration() {
  return (
    <View
      style={{
        width: 200,
        minHeight: 280,
        backgroundColor: "#F5F1E8",
        transform: [{ rotate: "-3deg" }],
        padding: 16,
        borderRadius: 4,
        shadowColor: "#000",
        shadowOpacity: 0.5,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 20 },
        elevation: 20,
      }}
    >
      <Text
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          color: "#3a342a",
          textAlign: "center",
          fontWeight: "700",
          letterSpacing: 2,
          marginBottom: 4,
        }}
      >
        MARCHÉ FRAIS
      </Text>
      <Text
        style={{
          fontFamily: "monospace",
          fontSize: 7,
          color: "#7a7158",
          textAlign: "center",
          marginBottom: 6,
        }}
      >
        17/05/26 · 14:32
      </Text>
      <View style={{ borderBottomWidth: 1, borderStyle: "dashed", borderColor: "#b8ad95", marginBottom: 6 }} />
      {["LAIT 1L", "BAGUETTE TR", "BANANES", "POULET 500G", "EPINARDS", "CREME FR.", "CITRONS"].map((l) => (
        <Text
          key={l}
          style={{ fontFamily: "monospace", fontSize: 8, color: "#3a342a", marginBottom: 2 }}
        >
          {l}
        </Text>
      ))}
      <View style={{ borderBottomWidth: 1, borderStyle: "dashed", borderColor: "#b8ad95", marginVertical: 6 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: "monospace", fontSize: 9, fontWeight: "700", color: "#3a342a" }}>TOTAL</Text>
        <Text style={{ fontFamily: "monospace", fontSize: 9, fontWeight: "700", color: "#3a342a" }}>27,84</Text>
      </View>
    </View>
  );
}

function ScanLoadingOverlay({ beamAnim }: { beamAnim: Animated.Value }) {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStageIdx((x) => (x + 1) % SCAN_STAGES.length), 800);
    return () => clearInterval(t);
  }, []);

  return (
    <View
      style={{
        position: "absolute",
        inset: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15,14,12,0.55)",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
      }}
    >
      {/* Scan beam */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 80,
          background: undefined,
          transform: [{ translateY: beamAnim }],
        }}
      >
        <View
          style={{
            flex: 1,
            background: undefined,
            backgroundColor: "transparent",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 80,
            backgroundColor: "rgba(63,143,92,0.4)",
          }}
        />
      </Animated.View>

      {/* Pulsing green circle */}
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#3F8F5C",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#3F8F5C",
          shadowOpacity: 0.6,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
          zIndex: 2,
        }}
      >
        <Sparkles size={26} color="#fff" strokeWidth={1.5} />
      </View>

      <Text
        style={{
          color: "#fff",
          fontSize: 15,
          fontWeight: "500",
          letterSpacing: -0.3,
          zIndex: 2,
        }}
      >
        {SCAN_STAGES[stageIdx]}
      </Text>
    </View>
  );
}

export default function ScanReceipt() {
  const router = useRouter();
  const { data: householdId } = useHousehold();
  const [scanning, setScanning] = useState(false);
  const [step, setStep] = useState<"idle" | "uploading" | "analysing">("idle");

  // Beam animation — do NOT use duration:0 in a loop with useNativeDriver:true,
  // it fires synchronously in the new arch and blows the call stack.
  const beamAnim = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
    if (!scanning) return;
    let active = true;
    const animate = () => {
      beamAnim.setValue(-80);
      Animated.timing(beamAnim, {
        toValue: 500,
        duration: 2000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && active) animate();
      });
    };
    animate();
    return () => {
      active = false;
      beamAnim.stopAnimation();
    };
  }, [scanning]);

  // Shared upload + analyse path used by camera, gallery, and PDF picker.
  async function uploadAndAnalyse(base64: string, kind: "image" | "pdf") {
    if (!householdId) return;
    setScanning(true);
    try {
      setStep("uploading");
      const ext = kind === "pdf" ? "pdf" : "jpg";
      const contentType = kind === "pdf" ? "application/pdf" : "image/jpeg";
      const path = `${householdId}/${Date.now()}.${ext}`;

      const arrayBuffer = decodeBase64(base64);
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, arrayBuffer, { contentType, upsert: false });
      if (uploadError) throw uploadError;

      setStep("analysing");
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/scan-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ image_path: path, household_id: householdId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur d'analyse");

      router.push({
        pathname: "/(app)/confirm-receipt",
        params: { receipt_id: data.receipt_id },
      });
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Impossible d'analyser le ticket.");
    } finally {
      setScanning(false);
      setStep("idle");
    }
  }

  async function pickAndScan(fromCamera: boolean) {
    // Cap at 1280px wide — Claude reads receipts fine at this resolution,
    // and a full 12MP phone photo would cost 3× more in vision tokens for no gain.
    const opts = { quality: 0.6, base64: true, maxWidth: 1280, maxHeight: 1280 } as const;
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ["images"] });
    if (result.canceled || !result.assets[0]?.base64) return;
    await uploadAndAnalyse(result.assets[0].base64, "image");
  }

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    // fetch() reads local file:// URIs in React Native — no expo-file-system needed
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = encodeBase64(arrayBuffer);
    await uploadAndAnalyse(base64, "pdf");
  }

  function openImport() {
    Alert.alert(
      "Importer un ticket",
      "Quel type de fichier ?",
      [
        { text: "Photo (galerie)", onPress: () => pickAndScan(false) },
        { text: "PDF", onPress: () => pickPdf() },
        { text: "Annuler", style: "cancel" },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#1A1A17" }}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A17" />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Top bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 14,
            paddingVertical: 8,
            zIndex: 2,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} color="#fff" strokeWidth={1.75} />
          </Pressable>

          <Text
            style={{
              color: "#fff",
              fontSize: 17,
              fontWeight: "600",
              letterSpacing: -0.3,
            }}
          >
            Scanner un ticket
          </Text>

          <Pressable
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={18} color="#fff" strokeWidth={1.75} />
          </Pressable>
        </View>

        {/* Viewfinder */}
        <View style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Receipt illustration */}
          <View
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#1A1A17",
            }}
          >
            <ReceiptIllustration />
          </View>

          {/* Corner brackets */}
          <CornerBrackets />

          {/* Loading overlay */}
          {scanning && <ScanLoadingOverlay beamAnim={beamAnim} />}
        </View>

        {/* Bottom controls */}
        {!scanning && (
          <View
            style={{
              backgroundColor: "#1A1A17",
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 16,
              zIndex: 2,
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 12,
                textAlign: "center",
                marginBottom: 18,
                letterSpacing: 0.2,
              }}
            >
              Cadre le ticket dans la zone
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 28,
              }}
            >
              {/* Import (gallery or PDF) */}
              <Pressable
                onPress={openImport}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ImageIcon size={22} color="#fff" strokeWidth={1.75} />
              </Pressable>

              {/* Shutter (camera) — hidden on web, camera API not available */}
              {Platform.OS !== "web" && (
                <Pressable
                  onPress={() => pickAndScan(true)}
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    borderWidth: 4,
                    borderColor: "rgba(255,255,255,0.85)",
                    backgroundColor: "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: "#fff",
                      borderWidth: 3,
                      borderColor: "#1a1a17",
                    }}
                  />
                </Pressable>
              )}

              {/* Sliders */}
              <Pressable
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SlidersHorizontal size={22} color="#fff" strokeWidth={1.75} />
              </Pressable>
            </View>

            <Text
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                textAlign: "center",
                letterSpacing: 2,
                marginTop: 14,
              }}
            >
              {Platform.OS === "web" ? "IMPORTER · MANUEL" : "IMPORTER · PHOTO · MANUEL"}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
