import { BackIcon, DirectionsIcon } from "@/assets/icons";
import { Colors } from "@/constants/theme";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createTranslator } from "@/i18n";

type Departure = {
  TripID: string;
  Trip: {
    Route: {
      ShortName: string;
      LongName: string;
      Color: string;
    };
    Headsign: string;
  };
  ArrivalTime: number;
};

type StopData = {
  departures: Departure[];
  stop: {
    StopID: string;
    Name: string;
    Lat: number;
    Lon: number;
  };
};

function formatDepartureTime(seconds: number): string {
  let h = Math.floor(seconds / 3600) % 24;
  let m = Math.floor((seconds % 3600) / 60);
  if (h < 0) h += 24;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function getDiffMinutes(arrivalTimeSeconds: number, referenceDate: Date): number {
  const refMidnight = new Date(referenceDate);
  refMidnight.setHours(0, 0, 0, 0);
  const refSecondsSinceMidnight = Math.floor(
    (referenceDate.getTime() - refMidnight.getTime()) / 1000
  );

  let diffSeconds = arrivalTimeSeconds - refSecondsSinceMidnight;
  if (diffSeconds > 43200) diffSeconds -= 86400;
  else if (diffSeconds < -43200) diffSeconds += 86400;

  return Math.floor(diffSeconds / 60);
}

export default function StopDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight) + 16;
  const { t } = createTranslator("stop_details");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StopData | null>(null);
  const [referenceDate] = useState<Date>(new Date("2026-07-03T12:00:00+02:00"));
  const [error, setError] = useState<string | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const timeIso = referenceDate.toISOString();
        const url = `https://4021.fr1.orionhost.xyz/data/transit/stop/${id}?time=${timeIso}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(t("errorFetchingData"));
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 bg-[#101922] justify-center items-center">
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  const previousDepartures =
    data?.departures?.filter((d) => getDiffMinutes(d.ArrivalTime, referenceDate) < 0) || [];
  const upcomingDepartures =
    data?.departures?.filter((d) => getDiffMinutes(d.ArrivalTime, referenceDate) >= 0) || [];

  const renderDeparture = (d: Departure, idx: number) => {
    const diff = getDiffMinutes(d.ArrivalTime, referenceDate);
    const color = d.Trip.Route.Color.startsWith("#")
      ? d.Trip.Route.Color
      : `#${d.Trip.Route.Color}`;
    const name = d.Trip.Route.ShortName || d.Trip.Route.LongName;

    return (
      <TouchableOpacity
        key={d.TripID + idx}
        onPress={() => router.push({
          pathname: "/trip-details",
          params: { id: d.TripID, currentStopId: id as string }
        })}
        className="flex-row items-center justify-between bg-[#17232f] p-4 rounded-xl mb-3 border border-[#263445]"
      >
        <View className="flex-row items-center flex-1">
          <View
            style={{ backgroundColor: color }}
            className="px-3 py-1 rounded-md mr-3 min-w-[50px] items-center justify-center"
          >
            <Text className="text-white font-bold text-[16px]">{name}</Text>
          </View>
          <Text
            className="text-white text-[16px] font-medium flex-1 mr-2"
            numberOfLines={1}
          >
            {d.Trip.Headsign}
          </Text>
        </View>
        <Text className="text-[#90adcb] text-[16px] font-bold">
          {diff < 0
            ? formatDepartureTime(d.ArrivalTime)
            : diff < 1
            ? t("approaching")
            : diff >= 120
            ? formatDepartureTime(d.ArrivalTime)
            : diff >= 60
            ? `${Math.floor(diff / 60)}h${(diff % 60).toString().padStart(2, "0")}`
            : t("minutes", { diff })}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-[#101922]">
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View
        className="flex-row items-center px-4 pb-3"
        style={{ paddingTop: topInset }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-12 h-12 rounded-full items-center justify-center"
        >
          <BackIcon />
        </TouchableOpacity>
        <Text
          className="text-white text-[18px] font-bold flex-1 text-center mr-12"
          numberOfLines={1}
        >
          {t("title")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}>
        {error ? (
          <Text className="text-[#ff6b6b] text-center mt-10">{error}</Text>
        ) : data ? (
          <>
            <View className="pt-3 mb-6">
              <Text className="text-white text-[32px] font-extrabold tracking-[-0.5px]">
                {data.stop.Name}
              </Text>
              <Text className="text-[#90adcb] text-[16px] mt-1">
                {t("publicTransportStop")}
              </Text>
              <View className="flex-row mt-6">
                <TouchableOpacity
                  className="flex-1 h-[56px] bg-primary rounded-[12px] flex-row items-center justify-center gap-2"
                  onPress={() => {
                    router.push({
                      pathname: "/(main)/routePlanning",
                      params: {
                        name: data.stop.Name,
                        lat: data.stop.Lat.toString(),
                        lng: data.stop.Lon.toString(),
                      },
                    });
                  }}
                >
                  <DirectionsIcon />
                  <Text className="text-white text-[16px] font-bold">
                    {t("directions")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {previousDepartures.length > 0 && (
              <View className="mb-6">
                <TouchableOpacity
                  className="flex-row items-center justify-between mb-3"
                  onPress={() => setShowPrevious(!showPrevious)}
                >
                  <Text className="text-[#90adcb] text-[14px] font-bold uppercase tracking-widest">
                    {t("previousDepartures")}
                  </Text>
                  <Text className="text-[#90adcb] text-[20px] font-bold">
                    {showPrevious ? "-" : "+"}
                  </Text>
                </TouchableOpacity>
                {showPrevious && previousDepartures.map(renderDeparture)}
              </View>
            )}

            <View>
              <Text className="text-[#90adcb] text-[14px] font-bold uppercase tracking-widest mb-3">
                {t("upcomingDepartures")}
              </Text>
              {upcomingDepartures.length > 0 ? (
                upcomingDepartures.map(renderDeparture)
              ) : (
                <Text className="text-white">{t("noUpcomingDepartures")}</Text>
              )}
            </View>
          </>
        ) : (
          <Text className="text-white text-center mt-10">{t("noData")}</Text>
        )}
      </ScrollView>
    </View>
  );
}
