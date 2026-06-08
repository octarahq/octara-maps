import MapSnapshot, { WaypointPin } from "@/components/MapSnapshot";
import { Colors } from "@/constants/theme";
import { usePosition } from "@/contexts/PositionContext";
import { createTranslator } from "@/i18n";
import { showCommingSoonToast } from "@/utils/commingSoonToast";
import { MaterialIcons } from "@expo/vector-icons";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import Constants from "expo-constants";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Linking,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouteService } from "../../services/RouteService";

const { t } = createTranslator("routePlanning");

export default function TransitPlanningScreen() {
  const { name, address, lat, lng } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight) + 28;
  const { position } = usePosition();
  const routeService = useRouteService();

  const destLat = lat ? parseFloat(lat as string) : null;
  const destLng = lng ? parseFloat(lng as string) : null;
  const destName = (name as string) || "";
  const destAddress =
    (address as string) || (lat && lng ? `${lat}, ${lng}` : "");

  const [transitDate, setTransitDate] = React.useState(new Date());
  const [transitTimeType, setTransitTimeType] = React.useState<
    "departure" | "arrival"
  >("departure");
  const [transitForbiddenModes, setTransitForbiddenModes] = React.useState<
    string[]
  >([]);
  const [showOptions, setShowOptions] = React.useState(false);
  const [fetchTrigger, setFetchTrigger] = React.useState(0);

  const [routeAlternatives, setRouteAlternatives] = React.useState<any[]>([]);
  const [selectedAlternativeIndex, setSelectedAlternativeIndex] =
    React.useState(0);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [routeError, setRouteError] = React.useState<string | null>(null);

  const resolvedCoords = React.useMemo(() => {
    const coords = [];
    if (position?.latitude && position?.longitude) {
      coords.push({
        latitude: position.latitude,
        longitude: position.longitude,
      });
    }
    if (destLat && destLng) {
      coords.push({ latitude: destLat, longitude: destLng });
    }
    return coords;
  }, [position, destLat, destLng]);

  React.useEffect(() => {
    if (resolvedCoords.length < 2) return;

    setIsCalculating(true);
    setRouteError(null);

    const fetchTransit = async () => {
      try {
        const datetimeStr = transitDate
          .toISOString()
          .replace(/[-:]/g, "")
          .split(".")[0];
        const alternatives = await routeService.getRoutes(
          resolvedCoords,
          "transit",
          {
            alternatives: 3,
            transitOptions: {
              datetime: datetimeStr,
              datetimeRepresents: transitTimeType,
              forbiddenModes: transitForbiddenModes,
            },
          },
        );

        if (alternatives && alternatives.length > 0) {
          setRouteAlternatives(alternatives);
          setSelectedAlternativeIndex(0);
        } else {
          setRouteAlternatives([]);
          setRouteError(
            t("errorNoRoute", { defaultValue: "Aucun itinéraire trouvé" }),
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setRouteError(errorMsg);
        setRouteAlternatives([]);
      } finally {
        setIsCalculating(false);
      }
    };
    fetchTransit();
  }, [resolvedCoords, fetchTrigger]);

  const handleStartNavigation = () => {
    showCommingSoonToast();
  };

  const selectedRoute = routeAlternatives[selectedAlternativeIndex];

  const mapPins: WaypointPin[] = [];
  if (resolvedCoords.length > 0) {
    mapPins.push({
      lat: resolvedCoords[0].latitude,
      lng: resolvedCoords[0].longitude,
      type: "departure",
    });
  }
  if (resolvedCoords.length > 1) {
    mapPins.push({
      lat: resolvedCoords[resolvedCoords.length - 1].latitude,
      lng: resolvedCoords[resolvedCoords.length - 1].longitude,
      type: "destination",
    });
  }

  const formatDuration = (min: number): string => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h${m}` : `${h}h`;
  };

  const formatDistance = (m: number): string => {
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1)} km`.replace(".0", "");
  };

  return (
    <View className="flex-1 bg-[#101922]">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <View
        className="flex-row items-center justify-between px-4 pb-3 border-b border-white/[0.08]"
        style={{ paddingTop: topInset }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-12 h-12 rounded-full items-center justify-center -ml-2"
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-[18px] font-bold flex-1 text-center">
          {t("transitRouting", { defaultValue: "Itinéraires" })}
        </Text>
        <TouchableOpacity
          onPress={() => setShowOptions(!showOptions)}
          className={`w-12 h-12 rounded-full items-center justify-center -mr-2 ${showOptions ? "bg-primary/20" : ""}`}
        >
          <MaterialIcons
            name="tune"
            size={24}
            color={showOptions ? Colors.dark.primary : "#fff"}
          />
        </TouchableOpacity>
      </View>

      <View className="h-[250px] w-full bg-[#12202a] z-10">
        <MapSnapshot
          pins={mapPins}
          routeCoords={selectedRoute?.coords}
          routeSections={selectedRoute?.sections}
          interactive
          style={{ width: "100%", height: "100%" }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="p-4">
          {showOptions && (
            <View className="mb-5 bg-[#12202a] rounded-[16px] p-4 border border-white/[0.07]">
              <Text className="text-white text-[16px] font-bold mb-3">
                {t("transitOptions", { defaultValue: "Options de transport" })}
              </Text>

              <Text className="text-[#90adcb] text-[13px] mb-2 font-medium">
                {t("transitSchedule", { defaultValue: "Horaires de trajet" })}
              </Text>

              <View className="bg-[#1e3040] rounded-[12px] p-2 mb-4">
                <View className="flex-row bg-[#12202a] rounded-[8px] p-1 mb-2">
                  <TouchableOpacity
                    className={`flex-1 py-2 rounded-[6px] items-center ${transitTimeType === "departure" ? "bg-primary" : "bg-transparent"}`}
                    onPress={() => setTransitTimeType("departure")}
                  >
                    <Text
                      className={`text-[14px] font-semibold ${transitTimeType === "departure" ? "text-white" : "text-[#90adcb]"}`}
                    >
                      {t("departAt", { defaultValue: "Partir à" })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 py-2 rounded-[6px] items-center ${transitTimeType === "arrival" ? "bg-primary" : "bg-transparent"}`}
                    onPress={() => setTransitTimeType("arrival")}
                  >
                    <Text
                      className={`text-[14px] font-semibold ${transitTimeType === "arrival" ? "text-white" : "text-[#90adcb]"}`}
                    >
                      {t("arriveAt", { defaultValue: "Arriver à" })}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row gap-2">
                  <View className="flex-1 flex-row items-center justify-between bg-[#12202a] rounded-[8px] p-1">
                    <TouchableOpacity
                      onPress={() => {
                        const nd = new Date(transitDate);
                        nd.setDate(nd.getDate() - 1);
                        setTransitDate(nd);
                      }}
                      className="w-8 h-8 items-center justify-center bg-[#1a2f42] rounded-[6px]"
                    >
                      <MaterialIcons
                        name="chevron-left"
                        size={20}
                        color="#fff"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        DateTimePickerAndroid.open({
                          value: transitDate,
                          onChange: (event: any, selectedDate?: Date) => {
                            if (selectedDate) setTransitDate(selectedDate);
                          },
                          mode: "date",
                        });
                      }}
                    >
                      <Text className="text-white text-[13px] font-bold px-1">
                        {transitDate.toDateString() ===
                        new Date().toDateString()
                          ? t("today", { defaultValue: "Aujourd'hui" })
                          : new Date(
                                transitDate.getTime() - 86400000,
                              ).toDateString() === new Date().toDateString()
                            ? t("tomorrow", { defaultValue: "Demain" })
                            : `${transitDate.getDate().toString().padStart(2, "0")}/${(transitDate.getMonth() + 1).toString().padStart(2, "0")}`}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const nd = new Date(transitDate);
                        nd.setDate(nd.getDate() + 1);
                        setTransitDate(nd);
                      }}
                      className="w-8 h-8 items-center justify-center bg-[#1a2f42] rounded-[6px]"
                    >
                      <MaterialIcons
                        name="chevron-right"
                        size={20}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-1 flex-row items-center justify-between bg-[#12202a] rounded-[8px] p-1">
                    <TouchableOpacity
                      onPress={() => {
                        const nd = new Date(transitDate);
                        nd.setMinutes(Math.ceil((nd.getMinutes() - 5) / 5) * 5);
                        setTransitDate(nd);
                      }}
                      className="w-8 h-8 items-center justify-center bg-[#1a2f42] rounded-[6px]"
                    >
                      <MaterialIcons name="remove" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        DateTimePickerAndroid.open({
                          value: transitDate,
                          onChange: (event: any, selectedDate?: Date) => {
                            if (selectedDate) setTransitDate(selectedDate);
                          },
                          mode: "time",
                          is24Hour: true,
                        });
                      }}
                    >
                      <Text className="text-white text-[15px] font-bold tracking-wider px-1">
                        {transitDate.getHours().toString().padStart(2, "0")}:
                        {transitDate.getMinutes().toString().padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const nd = new Date(transitDate);
                        nd.setMinutes(
                          Math.floor((nd.getMinutes() + 5) / 5) * 5,
                        );
                        setTransitDate(nd);
                      }}
                      className="w-8 h-8 items-center justify-center bg-[#1a2f42] rounded-[6px]"
                    >
                      <MaterialIcons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>

                {Math.abs(transitDate.getTime() - Date.now()) > 60000 && (
                  <TouchableOpacity
                    className="mt-2 py-2 items-center flex-row justify-center gap-1.5"
                    onPress={() => setTransitDate(new Date())}
                  >
                    <MaterialIcons
                      name="restore"
                      size={16}
                      color={Colors.dark.primary}
                    />
                    <Text className="text-primary text-[13px] font-bold">
                      {t("resetNow", {
                        defaultValue: "Réinitialiser (Maintenant)",
                      })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text className="text-[#90adcb] text-[13px] mb-2 font-medium">
                {t("transportModes", { defaultValue: "Modes de transport" })}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  {
                    id: "physical_mode:Bus",
                    label: t("transitModes.bus", { defaultValue: "Bus" }),
                    icon: "directions-bus",
                  },
                  {
                    id: "physical_mode:Tramway",
                    label: t("transitModes.tramway", { defaultValue: "Tramway" }),
                    icon: "tram",
                  },
                  { 
                    id: "physical_mode:Metro", 
                    label: t("transitModes.metro", { defaultValue: "Métro" }), 
                    icon: "subway" 
                  },
                  {
                    id: "physical_mode:RapidTransit",
                    label: t("transitModes.rer", { defaultValue: "RER" }),
                    icon: "train",
                  },
                  {
                    id: "physical_mode:LocalTrain",
                    label: t("transitModes.train", { defaultValue: "Train" }),
                    icon: "directions-railway",
                  },
                ].map((m) => {
                  const isActive = !transitForbiddenModes.includes(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-[8px] border ${isActive ? "bg-primary border-primary" : "bg-[#1e3040] border-transparent"}`}
                      onPress={() => {
                        setTransitForbiddenModes((prev) =>
                          isActive
                            ? [...prev, m.id]
                            : prev.filter((x) => x !== m.id),
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name={m.icon as any}
                        size={16}
                        color={isActive ? "#fff" : "#90adcb"}
                      />
                      <Text
                        className={`text-[13px] font-semibold ${isActive ? "text-white" : "text-[#90adcb]"}`}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                className="mt-4 bg-primary rounded-[12px] h-[48px] items-center justify-center elevation-4 shadow-primary shadow-opacity-20 shadow-radius-[8px] shadow-offset-[0,4]"
                onPress={() => {
                  setShowOptions(false);
                  setFetchTrigger((t) => t + 1);
                }}
              >
                <Text className="text-white text-[16px] font-bold">
                  {t("search", { defaultValue: "Rechercher" })}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {isCalculating && (
            <Text className="text-[#90adcb] text-[15px] italic text-center my-6">
              {t("searching", { defaultValue: "Recherche en cours..." })}
            </Text>
          )}

          {routeError && !isCalculating && (
            <View className="bg-red-500/10 border border-red-500/30 p-4 rounded-[12px] my-4">
              <Text className="text-red-400 text-center">{routeError}</Text>
            </View>
          )}

          {!isCalculating && routeAlternatives.length > 0 && (
            <View className="gap-[10px]">
              {routeAlternatives.map((alt, idx) => {
                const isSelectedAlt = selectedAlternativeIndex === idx;
                return (
                  <View key={idx}>
                    <TouchableOpacity
                      className="flex-row items-center justify-between px-3 py-[12px] bg-[#12202a] rounded-[12px] border border-white/10"
                      style={[
                        isSelectedAlt && {
                          backgroundColor: "rgba(13,127,242,0.12)",
                          borderColor: Colors.dark.primary,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => setSelectedAlternativeIndex(idx)}
                      activeOpacity={0.8}
                    >
                      <View className="flex-row items-center gap-3 flex-1">
                        <View
                          className="w-5 h-5 rounded-full border-2 border-gray-500 items-center justify-center"
                          style={[
                            isSelectedAlt && {
                              borderColor: Colors.dark.primary,
                            },
                          ]}
                        >
                          {isSelectedAlt && (
                            <View className="w-[10px] h-[10px] rounded-full bg-primary" />
                          )}
                        </View>
                        <View className="flex-1">
                          <View className="flex-row justify-between">
                            <Text
                              className="text-white/80 text-[15px] font-bold"
                              style={[isSelectedAlt && { color: "#fff" }]}
                            >
                              {t("route", {
                                n: idx + 1,
                                defaultValue: `Itinéraire ${idx + 1}`,
                              })}
                            </Text>
                            <Text className="text-white text-[15px] font-extrabold">
                              {formatDuration(alt.duration)}
                            </Text>
                          </View>
                          <Text
                            className="text-gray-500 text-[12px] mt-[2px]"
                            style={[
                              isSelectedAlt && {
                                color: Colors.dark.primary,
                              },
                            ]}
                          >
                            {formatDistance(alt.distance)}
                          </Text>
                          {alt.transitLines && (
                            <View className="flex-row items-center flex-wrap gap-1 mt-2">
                              {alt.transitLines.map(
                                (line: any, lidx: number) => (
                                  <View
                                    key={lidx}
                                    className="px-1.5 py-[2px] rounded-[4px]"
                                    style={{
                                      backgroundColor: `#${line.color}`,
                                    }}
                                  >
                                    <Text
                                      style={{ color: `#${line.text_color}` }}
                                      className="text-[10px] font-bold"
                                    >
                                      {line.code}
                                    </Text>
                                  </View>
                                ),
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>

                    {isSelectedAlt && alt.rawJourney && (
                      <View className="mt-2 bg-[#1a2f42] rounded-[12px] p-4 mx-2">
                        {alt.rawJourney.fare && (
                          <TouchableOpacity
                            className="mb-4 bg-[#12202a] self-start px-3 py-1.5 rounded-[8px] border border-white/10 flex-row items-center gap-2"
                            onPress={() => {
                              const buyLink =
                                alt.rawJourney?.fare?.links?.find(
                                  (l: any) => l.href && l.href !== "",
                                )?.href ||
                                alt.rawJourney?.tickets?.[0]?.links?.[0]
                                  ?.href ||
                                "https://www.iledefrance-mobilites.fr/titres-et-tarifs";
                              Linking.openURL(buyLink);
                            }}
                          >
                            <MaterialIcons
                              name="local-activity"
                              size={16}
                              color="#90adcb"
                            />
                            <Text className="text-white text-[13px] font-bold">
                              {t("buyTicket", {
                                defaultValue: "Acheter le billet",
                              })}{" "}
                              •{" "}
                              {alt.rawJourney.fare.total.currency === "centime"
                                ? (
                                    alt.rawJourney.fare.total.value / 100
                                  ).toFixed(2) + " €"
                                : `${alt.rawJourney.fare.total.value} ${alt.rawJourney.fare.total.currency}`}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {alt.rawJourney.sections
                          ?.filter((s: any) => s.type !== "waiting")
                          .map((sec: any, sIdx: number, arr: any[]) => {
                            const isTransit = sec.type === "public_transport";
                            const isWalking =
                              sec.type === "street_network" ||
                              sec.type === "transfer";
                            const info = sec.display_informations;
                            const isLast = sIdx === arr.length - 1;

                            if (!isTransit && !isWalking) return null;

                            return (
                              <View key={sIdx} className="flex-row">
                                <View className="w-12 items-center mr-2">
                                  {isTransit ? (
                                    <View
                                      className="h-6 min-w-[28px] px-1.5 rounded-[6px] items-center justify-center z-10"
                                      style={{
                                        backgroundColor: info?.color
                                          ? `#${info.color}`
                                          : "#333",
                                      }}
                                    >
                                      <Text
                                        className="text-[12px] font-bold"
                                        style={{
                                          color: info?.text_color
                                            ? `#${info.text_color}`
                                            : "#fff",
                                        }}
                                      >
                                        {info?.code}
                                      </Text>
                                    </View>
                                  ) : (
                                    <View className="w-6 h-6 rounded-full items-center justify-center bg-[#2a3c4d] z-10">
                                      <MaterialIcons
                                        name="directions-walk"
                                        size={14}
                                        color="#90adcb"
                                      />
                                    </View>
                                  )}
                                  <View
                                    className="w-[4px] flex-1 my-1 rounded-full"
                                    style={{
                                      backgroundColor:
                                        isTransit && info?.color
                                          ? `#${info.color}`
                                          : "#2a3c4d",
                                    }}
                                  />
                                  {isLast && (
                                    <View className="w-3 h-3 rounded-full bg-white z-10 mt-1" />
                                  )}
                                </View>

                                <View className="flex-1 pb-4">
                                  <View className="flex-row justify-between items-start mt-[2px]">
                                    <Text
                                      className="text-white text-[15px] font-bold flex-1 mr-2"
                                      numberOfLines={2}
                                    >
                                      {sec.from?.name ||
                                        t("departurePoint", {
                                          defaultValue: "Départ",
                                        })}
                                    </Text>
                                    {sec.departure_date_time && (
                                      <Text className="text-white font-semibold text-[13px]">
                                        {sec.departure_date_time.slice(9, 11)}:
                                        {sec.departure_date_time.slice(11, 13)}
                                      </Text>
                                    )}
                                  </View>

                                  {isTransit && (
                                    <View className="mt-1">
                                      <Text className="text-[#90adcb] text-[13px]">
                                        {t("direction", {
                                          defaultValue: "Direction",
                                        })}{" "}
                                        {info?.direction}
                                      </Text>
                                      {sec.stop_date_times?.length > 0 && (
                                        <Text className="text-gray-500 text-[12px]">
                                          {sec.stop_date_times.length}{" "}
                                          {t("stops", {
                                            defaultValue: "arrêts",
                                          })}
                                        </Text>
                                      )}
                                    </View>
                                  )}

                                  {isWalking && (
                                    <Text className="text-[#90adcb] text-[13px] mt-1">
                                      {t("walk", { defaultValue: "Marche" })} (
                                      {Math.round(sec.duration / 60)} min)
                                    </Text>
                                  )}

                                  {isLast && (
                                    <View className="flex-row justify-between items-start mt-4">
                                      <Text
                                        className="text-white text-[15px] font-bold flex-1 mr-2"
                                        numberOfLines={2}
                                      >
                                        {sec.to?.name ||
                                          t("arrivalPoint", {
                                            defaultValue: "Arrivée",
                                          })}
                                      </Text>
                                      {sec.arrival_date_time && (
                                        <Text className="text-white font-semibold text-[13px]">
                                          {sec.arrival_date_time.slice(9, 11)}:
                                          {sec.arrival_date_time.slice(11, 13)}
                                        </Text>
                                      )}
                                    </View>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-4 pt-4 bg-[#101922] border-t border-white/[0.05]"
        style={[{ paddingBottom: insets.bottom + 16 }]}
      >
        <TouchableOpacity
          className="bg-primary rounded-[16px] h-[56px] flex-row items-center justify-center gap-[10px] elevation-10 shadow-primary shadow-opacity-40 shadow-radius-[16px] shadow-offset-[0,6]"
          style={{
            backgroundColor:
              routeAlternatives.length === 0 ? "#1e3040" : Colors.dark.primary,
          }}
          onPress={handleStartNavigation}
          activeOpacity={0.9}
          disabled={routeAlternatives.length === 0}
        >
          <Text
            className={`text-[17px] font-extrabold ${routeAlternatives.length === 0 ? "text-[#90adcb]" : "text-white"}`}
          >
            {t("startNavigation", { defaultValue: "Lancer le trajet" })}
          </Text>
          <MaterialIcons
            name="near-me"
            size={22}
            color={routeAlternatives.length === 0 ? "#90adcb" : "#fff"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
