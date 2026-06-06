import {
  AppLogoIcon,
  HistoryIcon,
  HomeIcon,
  MoreIcon,
  WorkIcon,
} from "@/assets/icons";
import { AvatarImg } from "@/components/AvatarImg";
import { useHapticSettings } from "@/contexts/HapticSettingsContext";
import { useUser } from "@/contexts/UserContext";
import { createTranslator } from "@/i18n";
import { cn } from "@/utils/cn";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

interface MapOverlayProps {
  blockMap: boolean;
  onAvatarPress: () => void;
}

export default function MapOverlay({
  blockMap,
  onAvatarPress,
}: MapOverlayProps) {
  const { t } = createTranslator("main");
  const { vibration } = useHapticSettings();
  const { saved } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const handleChipPress = React.useCallback(
    (id?: string) => {
      triggerHaptic();
      if (id === "home" && saved.home) {
        router.push({
          pathname: "/(main)/place",
          params: {
            name: saved.home.name ?? t("chips.home"),
            address: saved.home.address,
            lat: String(saved.home.lat),
            lng: String(saved.home.lng),
          },
        });
      } else if (id === "work" && saved.work) {
        router.push({
          pathname: "/(main)/place",
          params: {
            name: saved.work.name ?? t("chips.work"),
            address: saved.work.address,
            lat: String(saved.work.lat),
            lng: String(saved.work.lng),
          },
        });
      } else if (id === "recent") {
        router.push("/(main)/(search)/search?mode=search");
      } else if (id === "more") {
        router.push("/(main)/(search)/search?mode=saved");
      }
    },
    [triggerHaptic, router, saved],
  );

  const handleAvatarPress = React.useCallback(() => {
    triggerHaptic();
    onAvatarPress();
  }, [triggerHaptic, onAvatarPress]);

  const chips = React.useMemo(() => {
    const list: {
      id: string;
      label: string;
      icon: React.ReactNode;
      onPress: () => void;
    }[] = [];

    if (saved.home) {
      list.push({
        id: "home",
        label: t("chips.home"),
        icon: <HomeIcon width={20} height={20} />,
        onPress: () => handleChipPress("home"),
      });
    }
    if (saved.work) {
      list.push({
        id: "work",
        label: t("chips.work"),
        icon: <WorkIcon width={20} height={20} />,
        onPress: () => handleChipPress("work"),
      });
    }

    list.push({
      id: "recent",
      label: t("chips.recent"),
      icon: <HistoryIcon />,
      onPress: () => handleChipPress("recent"),
    });

    list.push({
      id: "more",
      label: t("chips.more"),
      icon: <MoreIcon />,
      onPress: () => handleChipPress("more"),
    });

    return list;
  }, [saved, t, handleChipPress]);

  return (
    <>
      <View
        style={{ ...StyleSheet.absoluteFillObject, zIndex: 50 }}
        pointerEvents={blockMap ? "auto" : "box-none"}
      >
        <Svg
          height={320}
          width="100%"
          className="absolute top-0 left-0 right-0 z-50"
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#074fa8" stopOpacity="0.96" />
              <Stop offset="1" stopColor="#074fa8" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
        </Svg>

        <View
          className="absolute top-0 left-0 right-0 z-50"
          pointerEvents="auto"
          style={{ paddingTop: Math.max(insets.top, 16) }}
        >
          <View
            className="flex-row items-center justify-between mb-3 px-3"
            pointerEvents="auto"
          >
            <View className="flex-row items-center gap-2" pointerEvents="auto">
              <View className="w-9 h-9 rounded-2xl bg-[#0d7ff2] items-center justify-center">
                <AppLogoIcon width={20} height={20} fill="#fff" />
              </View>
              <Text className="text-white text-lg font-bold">Octara Maps</Text>
            </View>
            <TouchableOpacity
              className="w-10 h-10 rounded-full bg-[#0d7ff2] items-center justify-center overflow-hidden"
              onPress={handleAvatarPress}
            >
              <AvatarImg size={40} />
            </TouchableOpacity>
          </View>

          <View className="px-3" pointerEvents="auto">
            <TouchableOpacity
              className="h-12 rounded-[14px] bg-white/[0.3] px-4 justify-center"
              activeOpacity={1}
              onPress={() => {
                triggerHaptic();
                router.push("/(main)/(search)/search");
              }}
              accessibilityRole="button"
            >
              <Text
                className="text-white text-base"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {t("searchPlaceholder")}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            className="mt-3 px-3"
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="items-center"
            pointerEvents="auto"
            nestedScrollEnabled={true}
            directionalLockEnabled={true}
          >
            {chips.map((c, i) => (
              <TouchableOpacity
                key={c.id}
                className={cn(
                  "h-12 rounded-[14px] bg-white/[0.3] px-4 flex-row items-center gap-2 justify-center",
                  i !== chips.length - 1 && "mr-3",
                )}
                activeOpacity={0.7}
                onPress={c.onPress}
              >
                {c.icon}

                <Text
                  className="text-white text-base"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </>
  );
}
