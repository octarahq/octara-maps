import { BackIcon, MapIcon } from "@/assets/icons";
import MapProvider from "@/components/map";
import { createTranslator } from "@/i18n";
import { useRouter } from "expo-router";
import React, { useRef } from "react";
import { StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PointOnMapScreen() {
  const { t } = createTranslator("search");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const centerRef = useRef<{ lat: number; lng: number } | null>(null);

  const handleConfirm = () => {
    if (centerRef.current) {
      router.push({
        pathname: "/(main)/place",
        params: {
          lat: String(centerRef.current.lat),
          lng: String(centerRef.current.lng),
        },
      });
    }
  };

  return (
    <View className="flex-1 bg-[#101922]">
      <StatusBar
        hidden
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <View
        className="absolute top-0 w-full flex-row items-center justify-between px-4 pb-3 z-50 bg-[#101922]/80"
        style={{ paddingTop: Math.max(insets.top, 24) + 16 }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-12 h-12 rounded-full items-center justify-center bg-[#223649]/80"
        >
          <BackIcon />
        </TouchableOpacity>
        <Text className="text-white text-[18px] font-bold">
          Pointer sur la carte
        </Text>
        <View className="w-12 h-12" />
      </View>

      <View className="flex-1">
        <MapProvider
          style={{ flex: 1 }}
          allowedLayers={["streetView", "traffic", "transit"]}
          onCenterChange={(lat, lng) => {
            centerRef.current = { lat, lng };
          }}
        />

        <View className="absolute inset-0 items-center justify-center pointer-events-none">
          <View className="w-16 h-16 items-center justify-center">
            <View className="w-1.5 h-1.5 rounded-full bg-[#0d7ff2]" />
            <View className="absolute w-8 h-8 rounded-full border-2 border-[#0d7ff2] opacity-30" />
            <View className="absolute w-0.5 h-3 bg-[#0d7ff2] top-0" />
            <View className="absolute w-0.5 h-3 bg-[#0d7ff2] bottom-0" />
            <View className="absolute h-0.5 w-3 bg-[#0d7ff2] left-0" />
            <View className="absolute h-0.5 w-3 bg-[#0d7ff2] right-0" />
          </View>
        </View>
      </View>

      <View className="absolute bottom-10 w-full px-4 items-center z-50">
        <TouchableOpacity
          className="bg-primary w-full h-14 rounded-[16px] flex-row items-center justify-center"
          onPress={handleConfirm}
        >
          <MapIcon color="white" />
          <Text className="text-white font-bold text-[18px] ml-2">
            Confirmer la position
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
