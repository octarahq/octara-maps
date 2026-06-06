import BottomSelect, { BottomSelectHandle } from "@/components/ui/BottomSelect";
import { UserProfile, useUser } from "@/contexts/UserContext";
import { useAuth } from "@/hooks/useAuth";
import { createTranslator } from "@/i18n";
import { telemetryNavigationStart } from "@/services/TelemetryService";
import { MaterialIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Platform,
  Pressable,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
    selectOptions?: { label: string; value: string }[];
    selectedValue?: string;
    onSelectChange?: (val: string) => void;
    selectTitle?: string;
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
                  value={false} // Placeholder to suppress warning if needed, but normally should pass item.value
                  onValueChange={item.onValueChange}
                  trackColor={{ false: "#334155", true: "#0d7ff2" }}
                  thumbColor="#fff"
                />
              ) : (
                <MaterialIcons name="chevron-right" size={20} color="#64748b" />
              )}
            </Pressable>
            {item.selectOptions && Platform.OS === "android" && (
              <View style={{ width: 0, height: 0, overflow: "hidden" }}>
                <Picker
                  selectedValue={item.selectedValue}
                  onValueChange={(val) => item.onSelectChange?.(val)}
                  prompt={item.selectTitle}
                  style={{ opacity: 0 }}
                  ref={(ref) => {
                    // @ts-ignore
                    item._pickerRef = ref;
                  }}
                >
                  {item.selectOptions.map((opt) => (
                    <Picker.Item
                      key={opt.value}
                      label={opt.label}
                      value={opt.value}
                    />
                  ))}
                </Picker>
              </View>
            )}

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
  const { settings, setSettings } = useUser();
  const insets = useSafeAreaInsets();

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

  const handleSelectPress = (item: any) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...item.selectOptions.map((o: any) => o.label), "Annuler"],
          cancelButtonIndex: item.selectOptions.length,
          title: item.selectTitle,
        },
        (buttonIndex) => {
          if (buttonIndex < item.selectOptions.length) {
            item.onSelectChange?.(item.selectOptions[buttonIndex].value);
          }
        }
      );
    } else {
      if (item._pickerRef) {
        item._pickerRef.focus();
      }
    }
  };

  const transportOptions = [
    { label: t("transportations_mode.car"), value: "car" },
    { label: t("transportations_mode.bike"), value: "bike" },
    { label: t("transportations_mode.walk"), value: "walk" },
    { label: t("transportations_mode.transit"), value: "transit" },
  ];

  const voiceOptions = [
    { label: t("voice_guidance.none"), value: "none" },
    { label: t("voice_guidance.alert"), value: "alert" },
    { label: t("voice_guidance.all"), value: "all" },
  ];

  const themeOptions = [
    { label: t("map_theme.standard"), value: "standard" },
    { label: t("map_theme.standard_dark"), value: "standard_dark" },
    { label: t("map_theme.satelite"), value: "satelite" },
    { label: t("map_theme.terrain"), value: "terrain" },
    { label: t("map_theme.terrain_dark"), value: "terrain_dark" },
  ];

  return (
    <View
      className="flex-1 bg-[#101922] p-5"
      style={{ paddingTop: Math.max(insets.top, 20) }}
    >
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
            selectTitle: "Choisir un mode de transport",
            selectOptions: transportOptions,
            selectedValue: settings.favTransportMode,
            onSelectChange: (val) =>
              setSettings({
                ...settings,
                favTransportMode: val as UserProfile["settings"]["favTransportMode"],
              }),
            onClick: function () {
              handleSelectPress(this);
            },
          },
          {
            title: t("sections.0.settings.1.title"),
            description: t("sections.0.settings.1.description"),
            icon: "volume-up",
            selectTitle: "Choisir la methode de guidage par voix",
            selectOptions: voiceOptions,
            selectedValue: settings.voice,
            onSelectChange: (val) =>
              setSettings({
                ...settings,
                voice: val as UserProfile["settings"]["voice"],
              }),
            onClick: function () {
              handleSelectPress(this);
            },
          },
          {
            title: t("sections.0.settings.2.title"),
            description: t("sections.0.settings.2.description"),
            icon: "map",
            selectTitle: "Choisir le thème de la carte",
            selectOptions: themeOptions,
            selectedValue: settings.mapStyle,
            onSelectChange: (val) =>
              setSettings({
                ...settings,
                mapStyle: val as UserProfile["settings"]["mapStyle"],
              }),
            onClick: function () {
              handleSelectPress(this);
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


    </View>
  );
}
