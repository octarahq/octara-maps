import { CenterUserIcon, LayersIcon } from "@/assets/icons";
import { useHapticSettings } from "@/contexts/HapticSettingsContext";
import { usePosition } from "@/contexts/PositionContext";
import { snapPointsPercent } from "@/utils/snapPoints";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import {
    Platform,
    Pressable,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import LayersPanel from "./LayersPanel";
import { useMap } from "./MapContext";
import { useMapLayers } from "./MapLayersContext";

export default function Controls() {
  const m = useMap();
  const layers = useMapLayers();
  const { height: screenHeight } = useWindowDimensions();
  usePosition();
  const { followUser, centerAndFollow } = m;

  const isLightMap =
    (layers.mapType === "standard" || layers.mapType === "terrain") &&
    !layers.darkTheme;
  const iconColor = isLightMap ? "#000" : "#fff";
  const containerBg = isLightMap
    ? "rgba(255,255,255,0.8)"
    : "rgba(22,32,42,0.8)";
  const containerBorder = isLightMap
    ? "rgba(0,0,0,0.1)"
    : "rgba(255,255,255,0.1)";

  const snapPoints = React.useMemo(
    () => snapPointsPercent([240, 500], screenHeight),
    [screenHeight],
  );

  const centerOnUser = () => {
    if (followUser) {
      m.toggleFollow?.();
    } else {
      centerAndFollow?.();
    }
  };

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
    <>
      <View className="absolute right-3 top-[40%] z-[80]" pointerEvents="box-none">
        <View className="flex-col gap-3 items-center">
          <BlurView
            intensity={80}
            className="flex-col rounded-2xl overflow-hidden border shadow-lg"
            style={{ backgroundColor: containerBg, borderColor: containerBorder }}
          >
            <TouchableOpacity
              className="w-12 h-12 items-center justify-center border-b"
              style={{
                borderBottomColor: isLightMap
                  ? "rgba(0,0,0,0.12)"
                  : "rgba(255,255,255,0.1)",
              }}
              onPress={() => {
                triggerHaptic();
                m.zoomIn();
              }}
            >
              <Text className="text-[24px] leading-[24px]" style={{ color: iconColor }}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="w-12 h-12 items-center justify-center border-b"
              style={{
                borderBottomColor: isLightMap
                  ? "rgba(0,0,0,0.12)"
                  : "rgba(255,255,255,0.1)",
              }}
              onPress={() => {
                triggerHaptic();
                m.zoomOut();
              }}
            >
              <Text className="text-[24px] leading-[24px]" style={{ color: iconColor }}>−</Text>
            </TouchableOpacity>
          </BlurView>

          <BlurView
            intensity={80}
            className="rounded-2xl overflow-hidden border shadow-lg"
            style={{ backgroundColor: containerBg, borderColor: containerBorder }}
          >
            <TouchableOpacity
              className="w-12 h-12 items-center justify-center"
              onPress={() => {
                triggerHaptic();
                centerOnUser();
              }}
            >
              <CenterUserIcon active={followUser} />
            </TouchableOpacity>
          </BlurView>

          <BlurView
            intensity={80}
            className="rounded-2xl overflow-hidden border shadow-lg"
            style={{ backgroundColor: containerBg, borderColor: containerBorder }}
          >
            <TouchableOpacity
              className="w-12 h-12 items-center justify-center"
              onPress={() => {
                triggerHaptic();
                layers.openLayers();
              }}
            >
              <LayersIcon />
            </TouchableOpacity>
          </BlurView>
        </View>
      </View>

      {layers.layersOpen && (
        <View className="absolute inset-0 z-[100]">
          <Pressable
            className="absolute inset-0"
            onPress={layers.closeLayers}
            accessibilityLabel="Dismiss layers panel"
          />
          <BottomSheet
            snapPoints={snapPoints}
            index={0}
            enablePanDownToClose={true}
            backgroundStyle={{ backgroundColor: "rgba(16,25,34,1)" }}
            handleIndicatorStyle={{
              backgroundColor: "rgba(255,255,255,0.3)",
            }}
            onClose={layers.closeLayers}
          >
            <BottomSheetView
              style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 20 }}
            >
              <LayersPanel onClose={layers.closeLayers} />
            </BottomSheetView>
          </BottomSheet>
        </View>
      )}
    </>
  );
}

