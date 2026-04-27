import BottomSelect, { BottomSelectHandle } from "@/components/ui/BottomSelect";
import { UserProfile, useUser } from "@/contexts/UserContext";
import { useAuth } from "@/hooks/useAuth";
import { createTranslator } from "@/i18n";
import { telemetryNavigationStart } from "@/services/TelemetryService";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, Switch, Text, View } from "react-native";

function SettingsSection({
  title,
  items,
}: {
  title: string;
  items: {
    title: string;
    icon: React.ComponentProps<typeof MaterialIcons>["name"];
    description: string;
    onValueChange?: (value: boolean) => void;
    onClick?: () => void;
  }[];
}) {
  return (
    <View className="w-full mt-4">
      <Text className="text-[10px] font-bold uppercase tracking-[2px] text-[#64748b] mb-4 px-2">
        {title}
      </Text>

      <View className="bg-[#1a2530] rounded-[12px] overflow-hidden">
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <Pressable
              onPress={item.onClick}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-[20px] bg-white/5 items-center justify-center">
                  <MaterialIcons name={item.icon} size={20} color="#0d7ff2" />
                </View>
                <View>
                  <Text className="text-white text-[14px] font-medium">
                    {item.title}
                  </Text>
                  <Text className="text-[#64748b] text-[12px]">
                    {item.description}
                  </Text>
                </View>
              </View>
              {item.onValueChange ? (
                <Switch
                  value
                  onValueChange={item.onValueChange}
                  trackColor={{ false: "#334155", true: "#0d7ff2" }}
                  thumbColor="#fff"
                />
              ) : (
                <MaterialIcons name="chevron-right" size={20} color="#64748b" />
              )}
            </Pressable>

            {index < items.length - 1 && (
              <View className="h-[1px] bg-white/5 mx-4" />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = createTranslator("settings");
  const { isLoading } = useAuth();
  const selectModeRef = useRef<BottomSelectHandle>(null);
  const selectVoiceRef = useRef<BottomSelectHandle>(null);
  const selectCardThemeRef = useRef<BottomSelectHandle>(null);
  const { settings, setSettings } = useUser();

  useEffect(() => {
    telemetryNavigationStart("settings_screen");
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#101922] p-5 justify-center items-center">
        <ActivityIndicator size="large" color="#0d7ff2" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#101922] p-5">
      <View className="w-full flex-row items-center gap-4">
        <Pressable
          onPress={() => {
            router.back();
          }}
          className="p-2"
        >
          <MaterialIcons name="arrow-back" size={24} color="#0d7ff2" />
        </Pressable>
        <Text className="text-white text-[24px] font-bold mb-2">
          {t("title")}
        </Text>
      </View>

      <SettingsSection
        title={t("sections.0.title")}
        items={[
          {
            title: t("sections.0.settings.0.title"),
            description: t(`transportations_mode.${settings.favTransportMode}`),
            icon: "directions-car",
            onClick: () => {
              if (selectModeRef.current) selectModeRef.current.open();
            },
          },
          {
            title: t("sections.0.settings.1.title"),
            description: t("sections.0.settings.1.description"),
            icon: "volume-up",
            onClick: () => {
              if (selectVoiceRef.current) selectVoiceRef.current.open();
            },
          },
          {
            title: t("sections.0.settings.2.title"),
            description: t("sections.0.settings.2.description"),
            icon: "map",
            onClick: () => {
              if (selectCardThemeRef.current) selectCardThemeRef.current.open();
            },
          },
        ]}
      />

      <SettingsSection
        title={t("sections.1.title")}
        items={[
          {
            title: t("sections.1.settings.0.title"),
            description: t(`sections.1.settings.0.description`),
            icon: "share-location",
            onClick: () => {
              router.push("/(main)/(share)/location");
            },
          },
        ]}
      />

      <BottomSelect
        ref={selectModeRef}
        title="Choisir un mode de transport"
        items={[
          { key: "car", label: t("transportations_mode.car"), value: "car" },
          { key: "bike", label: t("transportations_mode.bike"), value: "bike" },
          { key: "walk", label: t("transportations_mode.walk"), value: "walk" },
          {
            key: "transit",
            label: t("transportations_mode.transit"),
            value: "transit",
          },
        ]}
        mode="single"
        initialSelected={settings.favTransportMode}
        onChange={(sel) =>
          setSettings({
            ...settings,
            favTransportMode:
              sel as UserProfile["settings"]["favTransportMode"],
          })
        }
      />
      <BottomSelect
        ref={selectVoiceRef}
        title="Choisir la methode de guidage par voix"
        items={[
          { key: "none", label: t("voice_guidance.none"), value: "none" },
          { key: "alert", label: t("voice_guidance.alert"), value: "alert" },
          { key: "all", label: t("voice_guidance.all"), value: "all" },
        ]}
        mode="single"
        initialSelected={settings.voice}
        onChange={(sel) =>
          setSettings({
            ...settings,
            voice: sel as UserProfile["settings"]["voice"],
          })
        }
      />
      <BottomSelect
        ref={selectCardThemeRef}
        title="Choisir le thème de la carte"
        items={[
          {
            key: "standard",
            label: t("map_theme.standard"),
            value: "standard",
          },
          {
            key: "standard_dark",
            label: t("map_theme.standard_dark"),
            value: "standard_dark",
          },
          {
            key: "satelite",
            label: t("map_theme.satelite"),
            value: "satelite",
          },
          { key: "terrain", label: t("map_theme.terrain"), value: "terrain" },
          {
            key: "terrain_dark",
            label: t("map_theme.terrain_dark"),
            value: "terrain_dark",
          },
        ]}
        mode="single"
        initialSelected={settings.mapStyle}
        onChange={(sel) =>
          setSettings({
            ...settings,
            mapStyle: sel as UserProfile["settings"]["mapStyle"],
          })
        }
      />
    </View>
  );
}
