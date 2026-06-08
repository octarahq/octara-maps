import { useUser } from "@/contexts/UserContext";
import { useAuth } from "@/hooks/useAuth";
import { createTranslator } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActionSheetIOS,
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TouchableOpacity,
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
                  value={false}
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
  const { settings, setSettings, language, setLanguage } = useUser();
  const insets = useSafeAreaInsets();

  const [activeSelect, setActiveSelect] = useState<any>(null);

  useEffect(() => {}, []);

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
        },
      );
    } else {
      setActiveSelect(item);
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
    { label: t("map_styles.standard"), value: "standard" },
    { label: t("map_styles.standard_dark"), value: "standard_dark" },
    { label: t("map_styles.satelite"), value: "satelite" },
    { label: t("map_styles.terrain"), value: "terrain" },
    { label: t("map_styles.terrain_dark"), value: "terrain_dark" },
  ];

  const languageOptions = [
    { label: "Français", value: "fr" },
    { label: "English", value: "en" },
  ];

  return (
    <View
      className="flex-1 bg-[#101922] p-5"
      style={{
        paddingTop: Math.max(insets.top, Constants.statusBarHeight) + 20,
      }}
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
            onClick: () =>
              handleSelectPress({
                selectTitle: "Choisir un mode de transport",
                selectOptions: transportOptions,
                selectedValue: settings.favTransportMode,
                onSelectChange: (val: any) =>
                  setSettings({
                    ...settings,
                    favTransportMode: val,
                  }),
              }),
          },
          {
            title: t("sections.0.settings.1.title"),
            description: t("sections.0.settings.1.description"),
            icon: "volume-up",
            onClick: () =>
              handleSelectPress({
                selectTitle: "Choisir la methode de guidage par voix",
                selectOptions: voiceOptions,
                selectedValue: settings.voice,
                onSelectChange: (val: any) =>
                  setSettings({
                    ...settings,
                    voice: val,
                  }),
              }),
          },
          {
            title: t("sections.0.settings.2.title"),
            description: t("sections.0.settings.2.description"),
            icon: "map",
            onClick: () =>
              handleSelectPress({
                selectTitle: "Choisir le thème de la carte",
                selectOptions: themeOptions,
                selectedValue: settings.mapStyle,
                onSelectChange: (val: any) =>
                  setSettings({
                    ...settings,
                    mapStyle: val,
                  }),
              }),
          },
          {
            title: t("sections.0.settings.3.title", { defaultValue: "Langue" }),
            description: t("sections.0.settings.3.description", { defaultValue: "Changer la langue de l'application" }),
            icon: "language",
            onClick: () =>
              handleSelectPress({
                selectTitle: "Choisir la langue",
                selectOptions: languageOptions,
                selectedValue: language,
                onSelectChange: (val: any) => setLanguage(val),
              }),
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

      {activeSelect && Platform.OS !== "ios" && (
        <Modal
          transparent={true}
          visible={!!activeSelect}
          animationType="fade"
          onRequestClose={() => setActiveSelect(null)}
        >
          <Pressable
            className="flex-1 bg-black/60 justify-center items-center p-6"
            onPress={() => setActiveSelect(null)}
          >
            <Pressable
              className="w-full max-w-[340px] bg-[#1a2530] rounded-[16px] overflow-hidden"
              onPress={(e) => e.stopPropagation()}
            >
              <View className="p-5 border-b border-white/5">
                <Text className="text-white text-[18px] font-bold">
                  {activeSelect.selectTitle}
                </Text>
              </View>
              <ScrollView className="max-h-[300px]">
                {activeSelect.selectOptions.map((opt: any) => (
                  <TouchableOpacity
                    key={opt.value}
                    className="flex-row items-center p-5 border-b border-white/5"
                    onPress={() => {
                      activeSelect.onSelectChange?.(opt.value);
                      setActiveSelect(null);
                    }}
                  >
                    <View
                      className={`w-5 h-5 rounded-full border-2 items-center justify-center mr-4 ${
                        activeSelect.selectedValue === opt.value
                          ? "border-[#0d7ff2]"
                          : "border-white/30"
                      }`}
                    >
                      {activeSelect.selectedValue === opt.value && (
                        <View className="w-2.5 h-2.5 rounded-full bg-[#0d7ff2]" />
                      )}
                    </View>
                    <Text className="text-white text-[16px]">{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View className="p-2 flex-row justify-end">
                <TouchableOpacity
                  className="px-4 py-3"
                  onPress={() => setActiveSelect(null)}
                >
                  <Text className="text-[#0d7ff2] font-bold text-[16px]">
                    ANNULER
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
