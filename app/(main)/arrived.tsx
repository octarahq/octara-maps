import MapSnapshot from "@/components/MapSnapshot";
import { Colors } from "@/constants/theme";
import { usePosition } from "@/contexts/PositionContext";
import { createTranslator } from "@/i18n";
import { showCommingSoonToast } from "@/utils/commingSoonToast";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type RouteParams = {
  name?: string;
  mode?: string;
  totalDuration?: string;
  totalDistance?: string;
  avgSpeed?: string;
  startLat?: string;
  startLng?: string;
  destLat?: string;
  destLng?: string;
};

const parseNumber = (value: string | undefined, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return "0 min";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder} min` : `${hours}h`;
};

const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(Math.max(0, meters))} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

export default function ArrivedScreen() {
  const { t } = createTranslator("navigate");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top - 10, 4);
  const params = useLocalSearchParams<RouteParams>();

  const destinationName = (
    params.name || (t("destinationFallback") as string)
  ).trim();
  const totalDuration = parseNumber(params.totalDuration, 0);
  const totalDistance = parseNumber(params.totalDistance, 0);
  const avgSpeed = parseNumber(params.avgSpeed, 0);

  const startLat = parseNumber(params.startLat, NaN);
  const startLng = parseNumber(params.startLng, NaN);
  const destLat = parseNumber(params.destLat, NaN);
  const destLng = parseNumber(params.destLng, NaN);

  const positionCtx = usePosition();
  const userPos = positionCtx.position;

  const hasDestination = Number.isFinite(destLat) && Number.isFinite(destLng);

  const pins = React.useMemo(() => {
    if (!hasDestination) return [];
    return [{ lat: destLat, lng: destLng, type: "destination" as const }];
  }, [hasDestination, destLat, destLng]);

  React.useEffect(() => {
    /* telemetry removed */;
  }, [params.mode, totalDistance, totalDuration]);

  const routeCoords: { latitude: number; longitude: number }[] = [];

  return (
    <View
      className={`flex bg-${Colors.dark.backgroundDark.replace("#", "")} pt-${topInset}`}
    >
      <ScrollView
        className={`flex bg-${Colors.dark.backgroundDark.replace("#", "")}`}
        contentContainerClassName="pb-4 px-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="h-14 flex-row items-center justify-between">
          <TouchableOpacity
            className="w-11 h-11 items-center justify-center"
            onPress={() => router.replace("/")}
            activeOpacity={0.75}
          >
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text className="w-full text-center text-white text-[18px] font-bold">
            {t("arrived.tripSummary")}
          </Text>
          <View className="w-11 h-11" />
        </View>

        <View className="items-center mt-2 mb-4">
          <Text className="text-white text-[34px] font-bold">
            {t("arrived.youHaveArrived")}
          </Text>
        </View>

        <View className="bg-[#17232f] rounded-14 overflow-hidden border border-[#263445]">
          {hasDestination ? (
            <MapSnapshot
              pins={pins}
              lat={userPos?.latitude}
              lng={userPos?.longitude}
              style={{
                height: 220,
                borderRadius: 0,
              }}
            />
          ) : (
            <View className="h-56 items-center justify-center gap-2">
              <MaterialIcons
                name="location-on"
                size={22}
                color={Colors.dark.primary}
              />
              <Text className="text-white text-[15px] font-bold">
                {destinationName}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-2 mt-3">
          <View className="bg-[#17232f] rounded-14 overflow-hidden border border-[#263445]">
            <View className="flex-row items-center gap-2 p-3">
              <MaterialIcons
                name="schedule"
                size={18}
                color={Colors.dark.primary}
              />
              <Text className="text-white text-[15px] font-bold">
                {t("arrived.time")}
              </Text>
            </View>
            <Text className="text-white text-[24px] font-bold px-4 pb-4">
              {formatDuration(totalDuration)}
            </Text>
          </View>

          <View className="bg-[#17232f] rounded-14 overflow-hidden border border-[#263445]">
            <View className="flex-row items-center gap-2 p-3">
              <MaterialIcons
                name="route"
                size={18}
                color={Colors.dark.primary}
              />
              <Text className="text-white text-[15px] font-bold">
                {t("arrived.distance")}
              </Text>
            </View>
            <Text className="text-white text-[24px] font-bold px-4 pb-4">
              {formatDistance(totalDistance)}
            </Text>
          </View>

          <View className="bg-[#17232f] rounded-14 overflow-hidden border border-[#263445]">
            <View className="flex-row items-center gap-2 p-3">
              <MaterialIcons
                name="speed"
                size={18}
                color={Colors.dark.primary}
              />
              <Text className="text-white text-[15px] font-bold">
                {t("arrived.avgSpeed")}
              </Text>
            </View>
            <Text className="text-white text-[24px] font-bold px-4 pb-4">
              {Math.round(Math.max(0, avgSpeed))} km/h
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2 mt-3">
          <TouchableOpacity
            className="flex-1 items-center justify-center h-14 rounded-12 bg-primary"
            onPress={() => router.replace("/")}
            activeOpacity={0.85}
          >
            <Text className="text-white text-[18px] font-bold">
              {t("arrived.done")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="min-h-[54px] rounded-12 bg-[#1d2b39] border border-[#2a3949] items-center justify-center px-3 py-3"
            onPress={() => showCommingSoonToast()}
            activeOpacity={0.85}
          >
            <Text className="text-white text-[16px] font-bold text-center">
              {t("arrived.findParking")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
