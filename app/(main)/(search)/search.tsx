import { SavePlaceModal } from "@/app/(main)/_components/SavePlaceModal";
import { Colors } from "@/constants/theme";
import { usePosition } from "@/contexts/PositionContext";
import { useUser } from "@/contexts/UserContext";
import { createTranslator } from "@/i18n";
import { showCommingSoonToast } from "@/utils/commingSoonToast";
import { clearRecentTrips, getRecentTrips } from "@/utils/recentTrips";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    ImageBackground,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    AddPlaceIcon,
    AddressIcon,
    AmenityIcon,
    ArrowRightIcon,
    BatimentIcon,
    BusStopIcon,
    CoffeeIcon,
    CommercialIcon,
    EditIcon,
    EvIcon,
    FoodIcon,
    GasIcon,
    HealthIcon,
    HistoryIcon,
    HomeIcon,
    ParkingIcon,
    SchoolIcon,
    SearchIcon,
    StarIcon,
    TrainStationIcon,
    WorkIcon,
} from "@/assets/icons";

import BackIcon from "@/assets/icons/BackIcon";
import BookmarkIcon from "@/assets/icons/BookmarkIcon";
import CompassIcon from "@/assets/icons/CompassIcon";
import activityImg from "@/assets/images/search/explore/activity.png";
import cultureImg from "@/assets/images/search/explore/culture.png";
import foodImg from "@/assets/images/search/explore/food.png";
import natureImg from "@/assets/images/search/explore/nature.png";
import nightlifeImg from "@/assets/images/search/explore/nightlife.png";
import shoppingImg from "@/assets/images/search/explore/shopping.png";
import socialImg from "@/assets/images/search/explore/social.png";
import topDiningImg from "@/assets/images/search/explore/topDining.png";
import { AvatarImg } from "@/components/AvatarImg";
import MapSnapshot from "@/components/MapSnapshot";
import OverPassAmenityList from "../../../assets/config/poiList";
import {
    PhotonFeature,
    SearchEngineService,
} from "../../../services/SearchEngineService";

const PlaceIcons = [
  { id: "home", icon: HomeIcon },
  { id: "work", icon: WorkIcon },
  { id: "heart", icon: HealthIcon },
  { id: "star", icon: StarIcon },
  { id: "school", icon: SchoolIcon },
];
export function SearchResult({
  icon,
  title,
  subtitle,
  onPress,
  onArrowPress,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  onArrowPress?: () => void;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center py-3 px-1 rounded-[12px]"
      onPress={onPress}
    >
      <View className="w-12 h-12 rounded-[12px] bg-[#223649] items-center justify-center mr-3">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-white font-bold">{title}</Text>
        {subtitle ? (
          <Text className="text-[#90adcb] text-[12px]">{subtitle}</Text>
        ) : null}
      </View>
      {onArrowPress ? (
        <TouchableOpacity onPress={onArrowPress} hitSlop={8}>
          <ArrowRightIcon />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const { t } = createTranslator("search");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight) + 16;
  const { mode: modeParam } = useLocalSearchParams();
  const initialMode =
    modeParam === "explore"
      ? "explore"
      : modeParam === "saved"
        ? "saved"
        : "search";
  const [mode, setMode] = React.useState<"search" | "explore" | "saved">(
    initialMode,
  );
  const [query, setQuery] = React.useState("");
  const compact = query.length >= 1;
  const initialMount = React.useRef(true);
  React.useEffect(() => {
    initialMount.current = false;
  }, []);
  const { saved } = useUser();
  const { position } = usePosition();
  const lastAddressQueryRef = React.useRef<string | null>(null);

  const [modalVisible, setModalVisible] = React.useState(false);
  const [modalSlot, setModalSlot] = React.useState<"home" | "work" | "other">(
    "home",
  );
  const [modalEditingIndex, setModalEditingIndex] = React.useState<
    number | null
  >(null);
  const [modalInitialData, setModalInitialData] = React.useState<{
    name: string;
    address: string;
    lat: string;
    lng: string;
  }>({ name: "", address: "", lat: "", lng: "" });

  const filteredAmenities = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return OverPassAmenityList.filter(
      (a) =>
        a.label.toLowerCase().includes(q) || a.value.toLowerCase().includes(q),
    );
  }, [query]);

  const [addressResults, setAddressResults] = React.useState<PhotonFeature[]>(
    [],
  );
  const [recentTrips, setRecentTrips] = React.useState<any[]>([]);
  const [visibleRecentCount, setVisibleRecentCount] = React.useState(5);

  React.useEffect(() => {
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

  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setAddressResults([]);
      lastAddressQueryRef.current = null;
      return;
    }

    let mounted = true;
    if (lastAddressQueryRef.current === q) return;

    const startTime = Date.now();
    const t = setTimeout(async () => {
      try {
        const results = await SearchEngineService.photonSearch(q, {
          limit: 10,
          lat: position?.latitude,
          lon: position?.longitude,
        });

        if (mounted) {
          lastAddressQueryRef.current = q;
          setAddressResults(results);

          const duration = Date.now() - startTime;
        }
      } catch (error) {
        if (mounted) {
          setAddressResults([]);
          const duration = Date.now() - startTime;

          const errorMsg =
            error instanceof Error ? error.message : String(error);
          if (
            errorMsg.includes("network") ||
            errorMsg.includes("timeout") ||
            errorMsg.includes("fetch")
          ) {
          } else {
          }
        }
      }
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [query, position?.latitude, position?.longitude]);

  return (
    <View className="flex-1 bg-[#101922]">
      <StatusBar
        hidden
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 64 }}>
        <View
          className="flex-row items-center px-3 pb-3"
          style={{ paddingTop: topInset }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center"
          >
            <BackIcon />
          </TouchableOpacity>
          <Text className="flex-1 text-white text-center text-[18px] font-bold">
            {t("title")}
          </Text>
          <TouchableOpacity
            className="w-10 h-10 rounded-[20px] bg-[#0d7ff2]/10 items-center justify-center overflow-hidden"
            onPress={() => router.push("/(main)/settings")}
          >
            <AvatarImg size={40} />
          </TouchableOpacity>
        </View>

        <View className="px-3">
          {mode !== "saved" && (
            <View className="h-14 rounded-[12px] bg-[#12202a] flex-row items-center px-3 mb-3">
              <Text className="text-[#90adcb] mr-2">
                <SearchIcon />
              </Text>
              <TextInput
                autoFocus={initialMount.current}
                placeholder={t("placeholder")}
                placeholderTextColor="#90adcb"
                className="flex-1 text-white text-[16px]"
                value={query}
                onChangeText={setQuery}
              />
            </View>
          )}
          {mode === "search" && compact && (
            <View className="mt-2 px-3">
              <ScrollView keyboardShouldPersistTaps="handled">
                {filteredAmenities.length > 0 &&
                  filteredAmenities.slice(0, 10).map((a) => (
                    <SearchResult
                      key={a.value}
                      icon={<AmenityIcon />}
                      title={a.label}
                      subtitle={t(`type_${a.type.toLowerCase()}`)}
                      onPress={() => {
                        setQuery(a.label);
                        showCommingSoonToast();
                      }}
                    />
                  ))}

                {addressResults.length > 0 &&
                  addressResults.slice(0, 10).map((r) => {
                    const isStationQuay = /\bquai\b/i.test(
                      r.properties?.street || "",
                    );
                    const isStation =
                      [
                        "bus_stop",
                        "bus_station",
                        "train_station",
                        "train_station_entrance",
                        "station",
                        "halt",
                        "tram_stop",
                        "subway_entrance",
                      ].includes(r.properties?.osm_value || "") ||
                      isStationQuay;
                    const isFoodPlace = [
                      "restaurant",
                      "fast_food",
                      "cafe",
                      "bar",
                      "pub",
                      "food_court",
                    ].includes(r.properties?.osm_value || "");
                    const isCommercial = [
                      "retail",
                      "supermarket",
                      "bakery",
                      "convenience",
                      "pharmacy",
                      "clothes",
                    ].includes(r.properties?.osm_value || "");
                    const isParking = r.properties?.osm_value === "parking";
                    const isFuel = r.properties?.osm_value === "fuel";
                    const isHealth = [
                      "hospital",
                      "clinic",
                      "pharmacy",
                      "doctors",
                    ].includes(r.properties?.osm_value || "");

                    const noStreet =
                      !r.properties?.housenumber && !r.properties?.street;
                    const streetInfo = [
                      r.properties?.housenumber,
                      r.properties?.street,
                    ]
                      .filter(Boolean)
                      .join(" ");

                    const title =
                      (isStation ||
                        isFoodPlace ||
                        isCommercial ||
                        isParking ||
                        isFuel ||
                        isHealth) &&
                      r.properties?.name
                        ? r.properties.name
                        : noStreet
                          ? r.properties?.city
                          : streetInfo;

                    const subtitle = noStreet
                      ? r.properties?.country
                      : [streetInfo, r.properties?.city]
                          .filter(Boolean)
                          .join(", ");

                    const PlaceIcon = noStreet ? (
                      <BatimentIcon />
                    ) : r.properties.osm_value === "bus_stop" ? (
                      <BusStopIcon />
                    ) : isStation ? (
                      <TrainStationIcon />
                    ) : isFoodPlace ? (
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
                      <SearchResult
                        key={`${r.properties?.osm_type || "p"}_${r.properties?.osm_id || r.geometry?.coordinates.join("_")}`}
                        icon={PlaceIcon}
                        title={title || t("unknown_place")}
                        subtitle={subtitle}
                        onPress={() => {
                          router.push({
                            pathname: "/(main)/place",
                            params: {
                              osm_id: r.properties?.osm_id,
                              osm_type: r.properties?.osm_type,
                              osm_value: r.properties?.osm_value,
                              address: subtitle,
                              name: title,
                              lat: r.geometry?.coordinates[1]?.toString(),
                              lng: r.geometry?.coordinates[0]?.toString(),
                            },
                          });
                        }}
                        onArrowPress={() => {
                          router.push({
                            pathname: "/(main)/routePlanning",
                            params: {
                              name: title,
                              address: subtitle,
                              lat: r.geometry?.coordinates[1]?.toString(),
                              lng: r.geometry?.coordinates[0]?.toString(),
                            },
                          });
                        }}
                      />
                    );
                  })}

                {addressResults.length === 0 &&
                  filteredAmenities.length === 0 && (
                    <View style={{ padding: 12 }}>
                      <Text style={{ color: "#90adcb" }}>No results</Text>
                    </View>
                  )}
              </ScrollView>
            </View>
          )}
          {mode === "search" && !compact && (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-3"
              >
                {[
                  { icon: <GasIcon />, label: t("chip_gas") },
                  { icon: <ParkingIcon />, label: t("chip_parking") },
                  { icon: <CoffeeIcon />, label: t("chip_coffee") },
                  { icon: <EvIcon />, label: t("chip_ev") },
                  { icon: <FoodIcon />, label: t("chip_food") },
                ].map((c) => (
                  <TouchableOpacity
                    key={c.label}
                    className="bg-[#223649] px-3.5 py-2 rounded-[8px] mr-2 flex-row items-center"
                    onPress={() => showCommingSoonToast()}
                  >
                    <View className="mr-2 w-6 h-6 items-center justify-center">
                      {c.icon}
                    </View>
                    <Text className="text-white font-semibold">{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View className="mt-2">
                <View className="flex-row justify-between items-center px-1 mb-2">
                  <Text className="text-white text-[16px] font-bold">
                    {t("recent_searches")}
                  </Text>
                  {recentTrips.length > 0 ? (
                    <TouchableOpacity
                      onPress={async () => {
                        await clearRecentTrips();
                        setRecentTrips([]);
                        setVisibleRecentCount(5);
                      }}
                    >
                      <Text className="text-[#0d7ff2]">{t("clear_all")}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {recentTrips.length === 0 ? (
                  <View style={{ padding: 12 }}>
                    <Text style={{ color: "#90adcb" }}>
                      {t("no_recent_trips") || "Aucun trajet récent"}
                    </Text>
                  </View>
                ) : (
                  recentTrips.slice(0, visibleRecentCount).map((r) => (
                    <SearchResult
                      key={`${r.lat}_${r.lng}_${r.ts}`}
                      icon={<HistoryIcon />}
                      title={r.name || r.address || ""}
                      subtitle={r.address || ""}
                      onPress={() => {
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

                {recentTrips.length > visibleRecentCount && (
                  <TouchableOpacity
                    style={{ padding: 8 }}
                    onPress={() => {
                      setVisibleRecentCount((c) => Math.min(10, c + 5));
                    }}
                  >
                    <Text style={{ color: "#0d7ff2" }}>
                      {t("show_more") || "Voir plus"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View className="mt-4 px-3">
                <Text className="text-white text-[16px] font-bold mb-2">
                  {t("explore_nearby")}
                </Text>
                <View className="flex-row flex-wrap justify-between">
                  <TouchableOpacity
                    className="w-[48%] aspect-video rounded-[16px] bg-[#334155] mb-3 justify-end p-2"
                    onPress={() => showCommingSoonToast()}
                  >
                    <ImageBackground
                      source={topDiningImg}
                      className="absolute inset-0 rounded-[16px]"
                      imageStyle={{ borderRadius: 16 }}
                    >
                      <View className="absolute inset-0 bg-black/40 rounded-[16px]" />
                    </ImageBackground>
                    <Text className="text-white font-bold z-10">
                      {t("card_top_dining")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="w-[48%] aspect-video rounded-[16px] bg-[#334155] mb-3 justify-end p-2"
                    onPress={() => showCommingSoonToast()}
                  >
                    <ImageBackground
                      source={nightlifeImg}
                      className="absolute inset-0 rounded-[16px]"
                      imageStyle={{ borderRadius: 16 }}
                    >
                      <View className="absolute inset-0 bg-black/40 rounded-[16px]" />
                    </ImageBackground>
                    <Text className="text-white font-bold z-10">
                      {t("card_nightlife")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="w-[48%] aspect-video rounded-[16px] bg-[#334155] mb-3 justify-end p-2"
                    onPress={() => showCommingSoonToast()}
                  >
                    <ImageBackground
                      source={natureImg}
                      className="absolute inset-0 rounded-[16px]"
                      imageStyle={{ borderRadius: 16 }}
                    >
                      <View className="absolute inset-0 bg-black/40 rounded-[16px]" />
                    </ImageBackground>
                    <Text className="text-white font-bold z-10">
                      {t("card_nature")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="w-[48%] aspect-video rounded-[16px] bg-[#334155] mb-3 justify-end p-2"
                    onPress={() => showCommingSoonToast()}
                  >
                    <ImageBackground
                      source={shoppingImg}
                      className="absolute inset-0 rounded-[16px]"
                      imageStyle={{ borderRadius: 16 }}
                    >
                      <View className="absolute inset-0 bg-black/40 rounded-[16px]" />
                    </ImageBackground>
                    <Text className="text-white font-bold z-10">
                      {t("card_shopping")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
          {mode === "explore" && !compact && (
            <View className="mt-4 px-3">
              <Text className="text-white text-[16px] font-bold mb-2">
                {t("explore_nearby")}
              </Text>
              <View className="flex-row flex-wrap justify-between">
                <TouchableOpacity
                  className="w-[48%] aspect-video rounded-[16px] bg-[#334155] mb-3 justify-end p-2"
                  onPress={() => showCommingSoonToast()}
                >
                  <ImageBackground
                    source={topDiningImg}
                    className="absolute inset-0 rounded-[16px]"
                    imageStyle={{ borderRadius: 16 }}
                  >
                    <View className="absolute inset-0 bg-black/40 rounded-[16px]" />
                  </ImageBackground>
                  <Text className="text-white font-bold z-10">
                    {t("card_top_dining")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-[48%] aspect-video rounded-[16px] bg-[#334155] mb-3 justify-end p-2"
                  onPress={() => showCommingSoonToast()}
                >
                  <ImageBackground
                    source={nightlifeImg}
                    className="absolute inset-0 rounded-[16px]"
                    imageStyle={{ borderRadius: 16 }}
                  >
                    <View className="absolute inset-0 bg-black/40 rounded-[16px]" />
                  </ImageBackground>
                  <Text className="text-white font-bold z-10">
                    {t("card_nightlife")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-[48%] aspect-video rounded-[16px] bg-[#334155] mb-3 justify-end p-2"
                  onPress={() => showCommingSoonToast()}
                >
                  <ImageBackground
                    source={natureImg}
                    className="absolute inset-0 rounded-[16px]"
                    imageStyle={{ borderRadius: 16 }}
                  >
                    <View className="absolute inset-0 bg-black/40 rounded-[16px]" />
                  </ImageBackground>
                  <Text className="text-white font-bold z-10">
                    {t("card_nature")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-[48%] aspect-video rounded-[16px] bg-[#334155] mb-3 justify-end p-2"
                  onPress={() => showCommingSoonToast()}
                >
                  <ImageBackground
                    source={shoppingImg}
                    className="absolute inset-0 rounded-[16px]"
                    imageStyle={{ borderRadius: 16 }}
                  >
                    <View className="absolute inset-0 bg-black/40 rounded-[16px]" />
                  </ImageBackground>
                  <Text className="text-white font-bold z-10">
                    {t("card_shopping")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-[48%] aspect-video rounded-[16px] bg-[#334155] mb-3 justify-end p-2"
                  onPress={() => showCommingSoonToast()}
                >
                  <ImageBackground
                    source={cultureImg}
                    className="absolute inset-0 rounded-[16px]"
                    imageStyle={{ borderRadius: 16 }}
                  >
                    <View className="absolute inset-0 bg-black/40 rounded-[16px]" />
                  </ImageBackground>
                  <Text className="text-white font-bold z-10">
                    {t("card_culture")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-[48%] aspect-video rounded-[16px] bg-[#334155] mb-3 justify-end p-2"
                  onPress={() => showCommingSoonToast()}
                >
                  <ImageBackground
                    source={activityImg}
                    className="absolute inset-0 rounded-[16px]"
                    imageStyle={{ borderRadius: 16 }}
                  >
                    <View className="absolute inset-0 bg-black/40 rounded-[16px]" />
                  </ImageBackground>
                  <Text className="text-white font-bold z-10">
                    {t("card_activities")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-[48%] aspect-video rounded-[16px] bg-[#334155] mb-3 justify-end p-2"
                  onPress={() => showCommingSoonToast()}
                >
                  <ImageBackground
                    source={foodImg}
                    className="absolute inset-0 rounded-[16px]"
                    imageStyle={{ borderRadius: 16 }}
                  >
                    <View className="absolute inset-0 bg-black/40 rounded-[16px]" />
                  </ImageBackground>
                  <Text className="text-white font-bold z-10">
                    {t("card_food")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-[48%] aspect-video rounded-[16px] bg-[#334155] mb-3 justify-end p-2"
                  onPress={() => showCommingSoonToast()}
                >
                  <ImageBackground
                    source={socialImg}
                    className="absolute inset-0 rounded-[16px]"
                    imageStyle={{ borderRadius: 16 }}
                  >
                    <View className="absolute inset-0 bg-black/40 rounded-[16px]" />
                  </ImageBackground>
                  <Text className="text-white font-bold z-10">
                    {t("card_social")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {mode === "saved" && !compact && (
            <View className="px-3 pb-3">
              <View className="py-2 pb-3">
                <Text className="text-white text-[32px] font-extrabold mb-2">
                  {t("saved_header")}
                </Text>
                <Text className="text-[#9fb7d3] text-[16px] max-w-[280px]">
                  {t("saved_desc")}
                </Text>
              </View>

              <View className="mt-3 flex-col">
                <TouchableOpacity
                  className="rounded-[12px] bg-[#0f1720] border border-white/[0.04] p-3 overflow-hidden mb-3"
                  onPress={() => {
                    if (saved.home) {
                      router.push({
                        pathname: "/(main)/place",
                        params: {
                          name: "Home",
                          address: saved.home.address,
                          lat: saved.home.lat?.toString(),
                          lng: saved.home.lng?.toString(),
                        },
                      });
                    } else {
                      setModalSlot("home");
                      setModalEditingIndex(null);
                      setModalInitialData({
                        name: "Home",
                        address: "",
                        lat: "",
                        lng: "",
                      });
                      setModalVisible(true);
                    }
                  }}
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-col flex-1">
                      <View className="flex-row items-center">
                        <View className="w-9 h-9 rounded-[10px] bg-[#0d7ff2]/8 items-center justify-center mr-2">
                          <HomeIcon color={Colors.dark.primary} />
                        </View>
                        <Text
                          className="text-white text-[20px] font-extrabold ml-2 shrink"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {t("card_home")}
                        </Text>
                      </View>
                      <Text
                        className="text-[#90adcb] text-[14px]"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {saved.home?.address || t("enter_home")}
                      </Text>
                    </View>

                    <TouchableOpacity
                      className="w-11 h-11 rounded-[22px] bg-[#0d7ff2] items-center justify-center"
                      onPress={() => {
                        setModalSlot("home");
                        setModalEditingIndex(null);
                        setModalInitialData({
                          name: "Home",
                          address: saved?.home?.address ?? "",
                          lat: saved?.home?.lat?.toString() ?? "",
                          lng: saved?.home?.lng?.toString() ?? "",
                        });
                        setModalVisible(true);
                      }}
                    >
                      {saved.home ? <EditIcon /> : <AddPlaceIcon />}
                    </TouchableOpacity>
                  </View>
                  {saved.home &&
                    saved.home.lat &&
                    saved.home.lng &&
                    saved.home.address && (
                      <MapSnapshot lat={saved.home.lat} lng={saved.home.lng} />
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                  className="rounded-[12px] bg-[#0f1720] border border-white/[0.04] p-3 overflow-hidden mb-3"
                  onPress={() => {
                    if (saved.work) {
                      router.push({
                        pathname: "/(main)/place",
                        params: {
                          name: "Work",
                          address: saved.work.address,
                          lat: saved.work.lat?.toString(),
                          lng: saved.work.lng?.toString(),
                        },
                      });
                    } else {
                      setModalSlot("work");
                      setModalEditingIndex(null);
                      setModalInitialData({
                        name: "Work",
                        address: "",
                        lat: "",
                        lng: "",
                      });
                      setModalVisible(true);
                    }
                  }}
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-col flex-1">
                      <View className="flex-row items-center">
                        <View className="w-9 h-9 rounded-[10px] bg-[#0d7ff2]/8 items-center justify-center mr-2">
                          <WorkIcon color={Colors.dark.primary} />
                        </View>
                        <Text
                          className="text-white text-[20px] font-extrabold ml-2 shrink"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {t("card_work")}
                        </Text>
                      </View>
                      <Text
                        className="text-[#90adcb] text-[14px]"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {saved.work?.address || t("enter_work")}
                      </Text>
                    </View>

                    <TouchableOpacity
                      className="w-11 h-11 rounded-[22px] bg-[#0d7ff2] items-center justify-center"
                      onPress={() => {
                        setModalSlot("work");
                        setModalEditingIndex(null);
                        setModalInitialData({
                          name: "Work",
                          address: saved?.work?.address ?? "",
                          lat: saved?.work?.lat?.toString() ?? "",
                          lng: saved?.work?.lng?.toString() ?? "",
                        });
                        setModalVisible(true);
                      }}
                    >
                      {saved.work ? <EditIcon /> : <AddPlaceIcon />}
                    </TouchableOpacity>
                  </View>
                  {saved.work &&
                    saved.work.lat &&
                    saved.work.lng &&
                    saved.work.address && (
                      <MapSnapshot lat={saved.work.lat} lng={saved.work.lng} />
                    )}
                </TouchableOpacity>

                {saved.other.map((place, idx) => {
                  const IconComp =
                    PlaceIcons.find((i) => i.id === place.icon)?.icon ||
                    StarIcon;
                  return (
                    <TouchableOpacity
                      key={idx}
                      className="rounded-[12px] bg-[#0f1720] border border-white/[0.04] p-3 overflow-hidden mb-3"
                      onPress={() => {
                        router.push({
                          pathname: "/(main)/place",
                          params: {
                            name: place.name || "",
                            address: place.address,
                            lat: place.lat?.toString() || "",
                            lng: place.lng?.toString() || "",
                          },
                        });
                      }}
                    >
                      <View className="flex-row justify-between items-start">
                        <View className="flex-col flex-1">
                          <View className="flex-row items-center">
                            <View className="w-9 h-9 rounded-[10px] bg-[#0d7ff2]/8 items-center justify-center mr-2">
                              <IconComp color={Colors.dark.primary} />
                            </View>
                            <Text
                              className="text-white text-[20px] font-extrabold ml-2 shrink"
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {place.name || "Other Place"}
                            </Text>
                          </View>
                          <Text
                            className="text-[#90adcb] text-[14px]"
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {place.address}
                          </Text>
                        </View>
                        <TouchableOpacity
                          className="w-11 h-11 rounded-[22px] bg-[#0d7ff2] items-center justify-center"
                          onPress={() => {
                            setModalSlot("other");
                            setModalEditingIndex(idx);
                            setModalInitialData({
                              name: place.name || "",
                              address: place.address,
                              lat: place.lat?.toString() || "",
                              lng: place.lng?.toString() || "",
                            });
                            setModalVisible(true);
                          }}
                        >
                          <EditIcon />
                        </TouchableOpacity>
                      </View>
                      {place.lat && place.lng && place.address ? (
                        <MapSnapshot lat={place.lat} lng={place.lng} />
                      ) : (
                        <View className="w-full h-[120px] rounded-[12px] mt-2 bg-[#12202a]" />
                      )}
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  className="mt-3 py-3.5 rounded-full border border-dashed border-white/[0.06] items-center justify-center"
                  onPress={() => {
                    setModalSlot("other");
                    setModalEditingIndex(null);
                    setModalInitialData({
                      name: "",
                      address: "",
                      lat: "",
                      lng: "",
                    });
                    setModalVisible(true);
                  }}
                >
                  <Text className="text-[#9fb7d3] font-semibold">
                    {t("modal_add_place")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {!compact && (
        <View className="absolute bottom-0 left-0 right-0 flex-row justify-around bg-[#101922]/90 py-2">
          <TouchableOpacity
            className="items-center"
            onPress={() => setMode("explore")}
          >
            <CompassIcon active={mode === "explore"} />
            <Text
              className={`text-white text-[10px] mt-0.5 uppercase shrink-0 ${mode === "explore" ? "text-[#0d7ff2]" : ""}`}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t("mode_explore")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="items-center"
            onPress={() => setMode("search")}
          >
            <SearchIcon active={mode === "search"} />
            <Text
              className={`text-white text-[10px] mt-0.5 uppercase shrink-0 ${mode === "search" ? "text-[#0d7ff2]" : ""}`}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t("mode_search")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="items-center"
            onPress={() => setMode("saved")}
          >
            <BookmarkIcon active={mode === "saved"} />
            <Text
              className={`text-white text-[10px] mt-0.5 uppercase shrink-0 ${mode === "saved" ? "text-[#0d7ff2]" : ""}`}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t("mode_saved")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <SavePlaceModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setModalEditingIndex(null);
        }}
        slot={modalSlot}
        editingIndex={modalEditingIndex}
        initialName={modalInitialData.name}
        initialAddress={modalInitialData.address}
        initialLat={modalInitialData.lat}
        initialLng={modalInitialData.lng}
      />
    </View>
  );
}
