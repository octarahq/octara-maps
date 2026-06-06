import { HistoryIcon } from "@/assets/icons";
import Header from "@/components/layout/Header";
import { createTranslator } from "@/i18n";
import { getRecentTrips } from "@/utils/recentTrips";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { SearchResult } from "./(search)/search";

export default function TripHistoryScreen() {
  const { t } = createTranslator("trip_history");
  const [recentTrips, setRecentTrips] = React.useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const r = await getRecentTrips();
      if (!mounted) return;
      setRecentTrips(r);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    /* telemetry removed */;
  }, []);

  return (
    <View className="flex-1 bg-[#101922]">
      <Header title={t("title")} />
      {recentTrips.length === 0 ? (
        <View className="p-3">
          <Text className="text-[#90adcb]">{t("emptyState.title")}</Text>
          <Text className="text-[#90adcb]">{t("emptyState.description")}</Text>
        </View>
      ) : (
        recentTrips.map((r) => (
          <SearchResult
            key={`${r.lat}_${r.lng}_${r.ts}`}
            icon={<HistoryIcon />}
            title={r.name || r.address || ""}
            subtitle={r.address || ""}
            onPress={() => {
              /* telemetry removed */;
              router.push({
                pathname: "/(main)/place",
                params: {
                  name: r.name,
                  address: r.address,
                  lat: String(r.lat),
                  lng: String(r.lng),
                },
              });
            }}
          />
        ))
      )}
    </View>
  );
}
