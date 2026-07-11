import { useUser } from "@/contexts/UserContext";
import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActionSheetIOS,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const modes = [
  { id: "standard", title: "Standard" },
  { id: "satellite", title: "Satellite" },
  { id: "terrain", title: "Terrain" },
];

export default function ProviderScreen() {
  const { settings, setSettings } = useUser();
  const insets = useSafeAreaInsets();
  const [activeSelect, setActiveSelect] = useState<any>(null);

  const mapProviders = settings.mapProviders || {
    standard: { type: "default" },
    satellite: { type: "default" },
    terrain: { type: "default" },
  };

  const getProviderOptions = (modeId: string) => {
    const baseOptions = [{ label: "Défaut", value: "default" }];
    
    if (modeId === "standard") {
      baseOptions.push({ label: "OpenFreeMap", value: "openfreemap" });
    } else if (modeId === "satellite") {
      baseOptions.push({ label: "IGN (France)", value: "ign" });
    } else if (modeId === "terrain") {
      baseOptions.push({ label: "OpenTopoMap", value: "opentopomap" });
    }
    
    baseOptions.push({ label: "Personnalisé", value: "custom" });
    return baseOptions;
  };

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

  const updateProvider = (mode: string, updates: any) => {
    setSettings({
      ...settings,
      mapProviders: {
        ...mapProviders,
        [mode]: {
          ...(mapProviders as any)[mode],
          ...updates,
        },
      },
    });
  };

  return (
    <View
      className="flex-1 bg-[#101922] p-5"
      style={{
        paddingTop: Math.max(insets.top, Constants.statusBarHeight) + 20,
      }}
    >
      <View className="w-full flex-row items-center gap-4 mb-6">
        <Pressable onPress={() => router.back()} className="p-2">
          <MaterialIcons name="arrow-back" size={24} color="#0d7ff2" />
        </Pressable>
        <Text className="text-white text-[24px] font-bold">
          Providers de carte
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {modes.map((mode) => {
          const currentConfig = (mapProviders as any)[mode.id] || { type: "default" };
          const modeOptions = getProviderOptions(mode.id);

          return (
            <View key={mode.id} className="mb-6">
              <Text className="text-[10px] font-bold uppercase tracking-[2px] text-[#64748b] mb-4 px-2">
                MODE {mode.title.toUpperCase()}
              </Text>
              <View className="bg-[#1a2530] rounded-[12px] overflow-hidden">
                <Pressable
                  onPress={() =>
                    handleSelectPress({
                      selectTitle: `Fournisseur pour ${mode.title}`,
                      selectOptions: modeOptions,
                      selectedValue: currentConfig.type,
                      onSelectChange: (val: any) => updateProvider(mode.id, { type: val }),
                    })
                  }
                  className={`flex-row items-center justify-between p-4 ${currentConfig.type === 'custom' ? 'border-b border-white/5' : ''}`}
                >
                  <View className="flex-row items-center gap-3">
                    <MaterialIcons name="public" size={20} color="#0d7ff2" />
                    <Text className="text-white text-[14px] font-medium">Fournisseur</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[#64748b]">
                      {modeOptions.find((o) => o.value === currentConfig.type)?.label || "Défaut"}
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color="#64748b" />
                  </View>
                </Pressable>

                {currentConfig.type === "custom" && (
                  <View className="p-4">
                    <Text className="text-[#64748b] text-[12px] mb-2">URL du Tile Provider (format: https://.../&#123;z&#125;/&#123;x&#125;/&#123;y&#125;.png)</Text>
                    <TextInput
                      className="bg-[#101922] text-white p-3 rounded-[8px] border border-white/10"
                      placeholder="https://votre-serveur/tile/{z}/{x}/{y}.png"
                      placeholderTextColor="#334155"
                      value={currentConfig.customUrl || ""}
                      onChangeText={(text) => updateProvider(mode.id, { customUrl: text })}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

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
