import {
  AddressIcon,
  CommercialIcon,
  FoodIcon,
  GasIcon,
  HealthIcon,
  ParkingIcon,
} from "@/assets/icons";
import Header from "@/components/layout/Header";
import { usePosition } from "@/contexts/PositionContext";
import { createTranslator } from "@/i18n";
import OverpassService, {
  NeerAmenityResponse,
} from "@/services/OverpassService";
import { telemetryNavigationStart } from "@/services/TelemetryService";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function POISearchScreen() {
  const { t } = createTranslator("poi_search");
  const [results, setResults] = React.useState<NeerAmenityResponse | null>(
    null,
  );
  const { loading, position } = usePosition();
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    telemetryNavigationStart("poi_search_screen");
  }, []);

  useEffect(() => {
    console.log("test", hasFetchedRef.current, position);
    if (position && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      console.log("fetch");
      OverpassService.fetchNeerAmenity(
        position.latitude,
        position.longitude,
        1000,
        "restaurant",
      )
        .then((res) => {
          console.log("Overpass results:", res);
          setResults(res);
        })
        .catch((e) => {
          console.error("Error fetching Overpass results:", e);
          setResults([]);
        });
    }
  }, [position?.latitude, position?.longitude]);

  if (results === null) {
    return (
      <View className="flex-1 pt-6 bg-[#101922]">
        <Header title={t("title")} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#e3e3e3" />
          <Text className="mt-4 text-center text-[#e3e3e3]">{t("loading")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 pt-6 bg-[#101922]">
      <Header title={t("title")} />

      <ScrollView contentContainerClassName="p-4 pb-10">
        <View className="flex-row justify-between items-center">
          <Text className="text-[#e3e3e3] text-lg font-bold">Nearby Classic</Text>
          {loading && <ActivityIndicator size="small" color="#e3e3e3" />}
        </View>

        {results.length === 0 && (
          <Text className="text-[#e3e3e3] text-sm mt-2">{t("no_results")}</Text>
        )}

        {results.map((result) => {
          const isFoodPlace = [
            "restaurant",
            "fast_food",
            "cafe",
            "bar",
            "pub",
            "food_court",
          ].includes(result.tags.amenity || "");
          const isCommercial = [
            "retail",
            "supermarket",
            "bakery",
            "convenience",
            "pharmacy",
            "clothes",
          ].includes(result.tags.amenity || "");
          const isParking = result.tags.amenity === "parking";
          const isFuel = result.tags.amenity === "fuel";
          const isHealth = [
            "hospital",
            "clinic",
            "pharmacy",
            "doctors",
          ].includes(result.tags.amenity || "");

          const PlaceIcon = isFoodPlace ? (
            <FoodIcon />
          ) : isCommercial ? (
            <CommercialIcon />
          ) : isHealth ? (
            <HealthIcon />
          ) : isParking ? (
            <ParkingIcon />
          ) : isFuel ? (
            <GasIcon />
          ) : (
            <AddressIcon />
          );

          return (
            <TouchableOpacity
              key={result.id}
              onPress={() =>
                router.push({
                  pathname: "/(main)/place",
                  params: {
                    osm_id: result.id,
                    osm_type: result.type[0].toUpperCase(),
                    osm_value: result.tags.amenity,
                    address: result.tags.address,
                    name: result.tags.name,
                    lat: result.lat,
                    lng: result.lon,
                  },
                })
              }
            >
              <View className="flex-row items-center mt-4 p-4 rounded-3xl border border-[#2e3a4c] bg-[#1a2533]">
                <View className="w-12 h-12 rounded-full bg-[#2e3a4c] justify-center items-center mr-4">{PlaceIcon}</View>
                {/* On limite le texte à sa colonne pour éviter qu'il pousse l'écran */}
                <View className="flex-1">
                  <Text className="text-[#e3e3e3] text-base font-bold" numberOfLines={1}>
                    {result.tags.name || "Unknown Restaurant"}
                  </Text>
                  <Text className="text-[#e3e3e3] text-sm mt-1" numberOfLines={1}>
                    {result.tags.cuisine || result.tags.amenity}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

