import { CarIcon, CloseIcon, MoonStarsIcon, TrainIcon } from "@/assets/icons";
import SvgPathIcon from "@/assets/icons/SvgPathIcon";
import { useHapticSettings } from "@/contexts/HapticSettingsContext";
import { createTranslator } from "@/i18n";
import { showCommingSoonToast } from "@/utils/commingSoonToast";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMapLayers } from "./MapLayersContext";

interface LayersPanelProps {
  onClose: () => void;
}

const MAP_TYPES = [
  {
    id: "standard" as const,
    label: "Standard",
    path: "m574-129-214-75-186 72q-10 4-19.5 2.5T137-136q-8 5-12.5 13.5T120-169v-561q0-13 7.5-23t20.5-15l186-63q6-2 12.5-3t13.5-1q7 0 13.5 1t12.5 3l214 75 186-72q10-4 19.5-2.5T823-824q8 5 12.5 13.5T840-791v561q0 13-7.5 23T812-192l-186 63q-6 2-12.5 3t-13.5 1q-7 0-13.5-1t-12.5-3Zm-14-89v-468l-160-56v468l160 56Zm80 0 120-40v-474l-120 46v468Zm-440-10 120-46v-468l-120 40v474Zm440-458v468-468Zm-320-56v468-468Z",
  },
  {
    id: "satellite" as const,
    label: "Satellite",
    path: "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-7-.5-14.5T799-507q-5 29-27 48t-52 19h-80q-33 0-56.5-23.5T560-520v-40H400v-80q0-33 23.5-56.5T480-720h40q0-23 12.5-40.5T563-789q-20-5-40.5-8t-42.5-3q-134 0-227 93t-93 227h200q66 0 113 47t47 113v40H400v110q20 5 39.5 7.5T480-160Z",
  },
  {
    id: "terrain" as const,
    label: "Terrain",
    path: "M120-240q-25 0-36-22t4-42l160-213q6-8 14.5-12t17.5-4q9 0 17.5 4t14.5 12l148 197h300L560-586l-68 90q-12 16-28 16.5t-28-8.5q-12-9-16-24.5t8-31.5l100-133q6-8 14.5-12t17.5-4q9 0 17.5 4t14.5 12l280 373q15 20 4 42t-36 22H120Zm340-80h300-312 68.5H460Zm-260 0h160l-80-107-80 107Zm0 0h160-160Z",
  },
];

export default function LayersPanel({ onClose }: LayersPanelProps) {
  const layers = useMapLayers();
  const { t } = createTranslator("main");
  const { vibration } = useHapticSettings();

  const impactStyle = React.useMemo(() => {
    const force = vibration.force ?? 1;
    if (force <= 0.6) return Haptics.ImpactFeedbackStyle.Light;
    if (force <= 1.4) return Haptics.ImpactFeedbackStyle.Medium;
    return Haptics.ImpactFeedbackStyle.Heavy;
  }, [vibration.force]);

  const triggerHaptic = React.useCallback(() => {
    Haptics.impactAsync(impactStyle).catch(() => {
      try {
        Haptics.selectionAsync();
      } catch {}
    });
  }, [impactStyle]);

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerClassName="pb-5"
    >
      <View className="flex-row justify-between items-center mb-6 pt-2">
        <Text className="text-2xl font-bold text-white">{t("layers.title")}</Text>
        <TouchableOpacity className="w-10 h-10 rounded-full bg-white/10 items-center justify-center" onPress={onClose}>
          <CloseIcon />
        </TouchableOpacity>
      </View>

      <View className="mb-8">
        <Text className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3px] mb-4">{t("layers.mapType")}</Text>
        <View className="flex-row justify-between gap-2">
          {MAP_TYPES.map((mapType) => (
            <TouchableOpacity
              key={mapType.id}
              className="flex-1 items-center gap-3"
              onPress={() => {
                triggerHaptic();
                layers.setMapType(mapType.id);
              }}
            >
              <View
                className={`w-16 h-16 rounded-full border-2 items-center justify-center ${layers.mapType === mapType.id ? "border-white bg-white" : "border-white/20 bg-white/5"}`}
              >
                <SvgPathIcon
                  d={mapType.path}
                  fill={layers.mapType === mapType.id ? "#000" : "#e3e3e3"}
                />
              </View>
              <Text
                className={`text-xs text-center ${layers.mapType === mapType.id ? "font-bold text-white" : "font-medium text-white/60"}`}
              >
                {t(`layers.mapTypes.${mapType.id}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View className="mb-8">
        <Text className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3px] mb-4">{t("layers.details")}</Text>

        {["standard", "terrain"].includes(layers.mapType) && (
          <View className="flex-row justify-between items-center py-3 border-b border-white/5">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 items-center justify-center">
                <MoonStarsIcon />
              </View>
              <Text className="text-base font-medium text-white">{t("layers.darkMap")}</Text>
            </View>
            <Switch
              value={layers.darkTheme}
              onValueChange={(v) => {
                triggerHaptic();
                layers.setDarkTheme(v);
              }}
              trackColor={{
                false: "rgba(255,255,255,0.1)",
                true: "rgba(255,255,255,0.25)",
              }}
              thumbColor={layers.darkTheme ? "#fff" : "#fff"}
              style={{ transform: [{ scaleX: 1 }, { scaleY: 1 }] }}
            />
          </View>
        )}
        <View className="flex-row justify-between items-center py-3 border-b border-white/5">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 items-center justify-center">
              <CarIcon />
            </View>
            <Text className="text-base font-medium text-white">{t("layers.traffic")}</Text>
          </View>
          <Switch
            value={layers.traffic}
            onValueChange={(v) => {
              return showCommingSoonToast();
              // triggerHaptic();
              // layers.setTraffic(v);
            }}
            trackColor={{
              false: "rgba(255,255,255,0.1)",
              true: "rgba(255,255,255,0.25)",
            }}
            thumbColor={layers.traffic ? "#fff" : "#fff"}
            style={{ transform: [{ scaleX: 1 }, { scaleY: 1 }] }}
          />
        </View>

        <View className="flex-row justify-between items-center py-3 border-b border-white/5">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 items-center justify-center">
              <TrainIcon />
            </View>
            <Text className="text-base font-medium text-white">
              {t("layers.publicTransport")}
            </Text>
          </View>
          <Switch
            value={layers.publicTransport}
            onValueChange={(v) => {
              return showCommingSoonToast();
              // triggerHaptic();
              // layers.setPublicTransport(v);
            }}
            trackColor={{
              false: "rgba(255,255,255,0.1)",
              true: "rgba(255,255,255,0.25)",
            }}
            thumbColor={layers.publicTransport ? "#fff" : "#fff"}
            style={{ transform: [{ scaleX: 1 }, { scaleY: 1 }] }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

