import { SavePlaceModal } from "@/app/(main)/_components/SavePlaceModal";
import {
    AddressIcon,
    BackIcon,
    BookmarkIcon,
    CallIcon,
    DirectionsIcon,
    ShareIcon,
    WebIcon,
} from "@/assets/icons";
import ScheduleIcon from "@/assets/icons/ScheduleIcon";
import MapSnapshot from "@/components/MapSnapshot";
import { Colors } from "@/constants/theme";
import { createTranslator } from "@/i18n";
import FreePlaceDetailsService from "@/services/PlaceDetailService";
import { snapPointsPercent } from "@/utils/snapPoints";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    ImageBackground,
    Linking,
    Platform,
    ScrollView,
    Share,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PlaceDetails = {
  id?: string;
  title?: string;
  description?: string;
  phone?: string | null;
  website?: string | null;
  opening_hours?: string | null;
  photos?: { url: string }[];
};

export default function PlaceDetailScreen() {
  const { osm_id, osm_type, osm_value, address, name, lat, lng } =
    useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight) + 16;
  const { t } = createTranslator("place");
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [hoursModalVisible, setHoursModalVisible] = useState(false);

  const WEB_BASE =
    process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://maps.octara.xyz";

  const handleShare = async () => {
    const params = new URLSearchParams();
    if (osm_id) params.set("osm_id", osm_id as string);
    if (osm_type) params.set("osm_type", osm_type as string);
    if (osm_value) params.set("osm_value", osm_value as string);
    if (name) params.set("name", placeTitle);
    if (address) params.set("address", placeAddress);
    const webUrl = `${WEB_BASE}/place?${params.toString()}`;
    try {
      await Share.share(
        Platform.OS === "ios"
          ? { url: webUrl, message: placeTitle }
          : { message: `${placeTitle}\n${webUrl}` },
      );
    } catch {}
  };

  useEffect(() => {
    async function loadDetails() {
      if (!osm_id || !osm_type) {
        setLoading(false);
        return;
      }
      const startTime = Date.now();
      try {
        const data = await FreePlaceDetailsService.fetchById(
          osm_type as "N" | "W" | "R",
          parseInt(osm_id as string),
        );
        setDetails(data);

        const duration = Date.now() - startTime;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : String(error);
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [osm_id, osm_type]);

  const placeTitle = (details?.title || name || t("unknownPlace")) as string;
  const placeAddress = (address || "") as string;

  const [ohUtils, setOhUtils] = useState<any>(null);
  const [ohStatus, setOhStatus] = useState<any>(null);


  useEffect(() => {
    let mounted = true;
    (async () => {
      const mod = await import("@/utils/openingHours");
      if (!mounted) return;
      setOhUtils(mod);
      setOhStatus(mod.computeOpeningStatus(details?.opening_hours || null));
    })();
    return () => {
      mounted = false;
    };
  }, [details?.opening_hours]);

  const getCategorization = () => {
    const val = (osm_value as string) || "";
    if (["restaurant", "fast_food", "food_court"].includes(val))
      return t("categories.restaurant");
    if (["cafe", "bar", "pub"].includes(val)) return t("categories.cafe");
    if (val === "fuel") return t("categories.gasStation");
    if (val === "parking") return t("categories.parking");
    if (["hospital", "clinic", "pharmacy", "doctors"].includes(val))
      return t("categories.health");
    if (
      ["retail", "supermarket", "bakery", "convenience", "mall"].includes(val)
    )
      return t("categories.commerce");
    if (["bus_stop", "bus_station", "train_station", "tram_stop"].includes(val))
      return t("categories.publicTransport");
    return (
      val.charAt(0).toUpperCase() + val.slice(1).replace("_", " ") ||
      t("categories.location")
    );
  };

  const categoryLabel = getCategorization();

  if (loading) {
    return (
      <View className="flex-1 bg-[#101922] justify-center items-center">
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  const headerImage = details?.photos?.[0]?.url || null;

  return (
    <View className="flex-1 bg-[#101922]">
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <View
        className="flex-row items-center justify-between px-4 pb-3"
        style={{ paddingTop: topInset }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-12 h-12 rounded-full items-center justify-center"
        >
          <BackIcon />
        </TouchableOpacity>
        <Text
          className="text-white text-[18px] font-bold flex-1 text-center"
          numberOfLines={1}
        >
          {t("title")}
        </Text>
        <TouchableOpacity
          className="w-12 h-12 rounded-full items-center justify-center"
          onPress={handleShare}
        >
          <ShareIcon />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {headerImage && (
          <View className="px-4 py-3">
            <ImageBackground
              source={{ uri: headerImage }}
              className="w-full h-64 rounded-[16px] overflow-hidden"
              imageStyle={{ borderRadius: 16 }}
            />
          </View>
        )}

        <View className="px-4 pt-3">
          <Text className="text-white text-[32px] font-extrabold tracking-[-0.5px]">
            {placeTitle}
          </Text>
          <Text className="text-[#90adcb] text-[16px] mt-1">
            {categoryLabel}
            {details?.cuisine ? ` • ${details.cuisine.charAt(0).toUpperCase() + details.cuisine.slice(1).replace(/_/g, " ")}` : ""}
          </Text>

          <View className="flex-row mt-6 gap-3">
            <TouchableOpacity
              className="flex-1 h-[56px] bg-primary rounded-[12px] flex-row items-center justify-center gap-2"
              onPress={() => {
                router.push({
                  pathname: "/(main)/routePlanning",
                  params: {
                    name: placeTitle,
                    address: placeAddress,
                    lat: lat as string,
                    lng: lng as string,
                  },
                });
              }}
            >
              <DirectionsIcon />
              <Text className="text-white text-[16px] font-bold">
                {t("directions")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="w-[56px] h-[56px] bg-[#223649] rounded-[12px] items-center justify-center"
              onPress={() => {
                setSaveModalVisible(true);
              }}
            >
              <BookmarkIcon />
            </TouchableOpacity>
            {details?.phone && (
              <TouchableOpacity
                className="w-[56px] h-[56px] bg-[#223649] rounded-[12px] items-center justify-center"
                onPress={() => {
                  Linking.openURL(`tel:${details.phone}`);
                }}
              >
                <CallIcon />
              </TouchableOpacity>
            )}
            {details?.website && (
              <TouchableOpacity
                className="w-[56px] h-[56px] bg-[#223649] rounded-[12px] items-center justify-center"
                onPress={() => {
                  WebBrowser.openBrowserAsync(details.website!);
                }}
              >
                <WebIcon />
              </TouchableOpacity>
            )}
          </View>

          <View className="mt-8 gap-6">
            {address && (
              <View>
                <View className="flex-row gap-4">
                  <View className="w-10 h-10 rounded-[8px] bg-primary/10 items-center justify-center">
                    <AddressIcon color={Colors.dark.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[#90adcb] text-[12px] font-semibold uppercase tracking-widest">
                      {t("address")}
                    </Text>
                    <Text className="text-white text-[16px] font-medium mt-[2px]">
                      {placeAddress}
                    </Text>
                  </View>
                </View>


              </View>
            )}

            {details?.opening_hours && (
              <View>
                <TouchableOpacity
                  className="flex-row gap-4"
                  onPress={() => {
                    setHoursModalVisible(!hoursModalVisible);
                  }}
                >
                  <View className="w-10 h-10 rounded-[8px] bg-primary/10 items-center justify-center">
                    <ScheduleIcon color={Colors.dark.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[#90adcb] text-[12px] font-semibold uppercase tracking-widest">
                      {t("hours")}
                    </Text>
                    <View className="flex-row justify-between items-center mr-2">
                      <Text className="text-white text-[16px] font-medium mt-[2px]">
                        {ohStatus
                          ? ((): string => {
                              const today = new Date().getDay();
                              const next = ohStatus.nextChange;
                              const daysAny = t("daysShort", {
                                returnObjects: true,
                              }) as unknown;
                              const daysShort = Array.isArray(daysAny)
                                ? (daysAny as string[])
                                : [];
                              const nextDay = next ? next.getDay() : null;

                              if (ohStatus.isOpen) {
                                const mins = ohStatus.minutesToChange;
                                if (mins != null && mins < 60)
                                  return t("closesIn", { mins });
                                return t("closesAt", {
                                  time: ohUtils.formatTimeForDisplay(
                                    ohStatus.nextChange,
                                  ),
                                });
                              } else {
                                const mins = ohStatus.minutesToChange;
                                if (mins != null && mins <= 4 * 60)
                                  return t("opensIn", { mins });
                                if (ohStatus.nextChange) {
                                  const time = ohUtils.formatTimeForDisplay(
                                    ohStatus.nextChange,
                                  );
                                  const daySuffix =
                                    nextDay !== null && nextDay !== today
                                      ? ` (${daysShort[nextDay]})`
                                      : "";
                                  return t("opensAt", { time }) + daySuffix;
                                }
                                return t("closed");
                              }
                            })()
                          : ""}
                      </Text>
                      {ohStatus ? (
                        ohStatus.isOpen ? (
                          <View className="bg-[#2ecc71]/10 px-2 py-1 rounded">
                            <Text className="text-[#2ecc71] text-[10px] font-extrabold">
                              {t("openNow")}
                            </Text>
                          </View>
                        ) : (
                          <View className="bg-[#ff6b6b]/10 px-2 py-1 rounded">
                            <Text className="text-[#ff6b6b] text-[10px] font-extrabold">
                              {t("closed")}
                            </Text>
                          </View>
                        )
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>

                {hoursModalVisible && ohStatus && (
                  <View className="mt-3 ml-14 bg-[#223649] p-3 rounded-[8px]">
                    {ohUtils?.formatDayLines(ohStatus.rules).map((l: string) => (
                      <Text key={l} className="text-white text-[14px] mb-1">
                        {l}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {details?.phone && (
              <TouchableOpacity className="flex-row gap-4" onPress={() => Linking.openURL(`tel:${details.phone}`)}>
                <View className="w-10 h-10 rounded-[8px] bg-primary/10 items-center justify-center">
                  <CallIcon />
                </View>
                <View className="flex-1 justify-center">
                  <Text className="text-[#90adcb] text-[12px] font-semibold uppercase tracking-widest">
                    {t("phone") || "Téléphone"}
                  </Text>
                  <Text className="text-white text-[16px] font-medium mt-[2px]">
                    {details.phone}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {details?.website && (
              <TouchableOpacity className="flex-row gap-4" onPress={() => WebBrowser.openBrowserAsync(details.website!)}>
                <View className="w-10 h-10 rounded-[8px] bg-primary/10 items-center justify-center">
                  <WebIcon />
                </View>
                <View className="flex-1 justify-center">
                  <Text className="text-[#90adcb] text-[12px] font-semibold uppercase tracking-widest">
                    {t("website") || "Site Web"}
                  </Text>
                  <Text className="text-white text-[16px] font-medium mt-[2px]" numberOfLines={1}>
                    {details.website}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {details?.email && (
              <View className="flex-row gap-4">
                <View className="w-10 h-10 rounded-[8px] bg-primary/10 items-center justify-center">
                  <Text className="text-[#0d7ff2] font-bold text-[18px]">@</Text>
                </View>
                <View className="flex-1 justify-center">
                  <Text className="text-[#90adcb] text-[12px] font-semibold uppercase tracking-widest">
                    {t("email") || "Email"}
                  </Text>
                  <Text className="text-white text-[16px] font-medium mt-[2px]" numberOfLines={1}>
                    {details.email}
                  </Text>
                </View>
              </View>
            )}

            <View className="mt-6 mb-4 bg-[#17232f] rounded-[14px] overflow-hidden border border-[#263445]">
              <MapSnapshot
                lat={parseFloat(lat as string)}
                lng={parseFloat(lng as string)}
                pins={[{ lat: parseFloat(lat as string), lng: parseFloat(lng as string), type: "destination" }]}
                className="w-full h-[220px]"
                interactive={true}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <SavePlaceModal
        visible={saveModalVisible}
        onClose={() => setSaveModalVisible(false)}
        slot="other"
        initialName={placeTitle}
        initialAddress={placeAddress}
        initialLat={(lat as string) || ""}
        initialLng={(lng as string) || ""}
      />


    </View>
  );
}
