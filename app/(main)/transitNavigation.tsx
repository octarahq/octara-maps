import MapSnapshot, {
  MapSnapshotRef,
  WaypointPin,
} from "@/components/MapSnapshot";
import Controls from "@/components/map/Controls";
import { MapContext } from "@/components/map/MapContext";
import { usePosition } from "@/contexts/PositionContext";
import { createTranslator } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function getDistanceMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const { t } = createTranslator("navigate");

export default function TransitNavigationScreen() {
  const mapRef = React.useRef<MapSnapshotRef>(null);
  const [followUser, setFollowUser] = React.useState(true);
  const { route, routeId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [routeData, setRouteData] = useState<any>(null);

  React.useEffect(() => {
    async function loadRoute() {
      if (routeId) {
        const { RouteCacheService } =
          await import("../../services/RouteCacheService");
        const cached = await RouteCacheService.getCachedRoute(
          routeId as string,
        );
        if (cached?.routeData) {
          setRouteData(cached.routeData);
        }
      } else if (route) {
        try {
          setRouteData(JSON.parse(route as string));
        } catch (e) {
          console.warn("Failed to parse route data", e);
        }
      }
    }
    loadRoute();
  }, [routeId, route]);

  const [mapExpanded, setMapExpanded] = useState(false);

  const { position, setInterpolationEnabled } = usePosition();
  
  let isWalking = false;

  let currentZoomLevel = 16;

  React.useEffect(() => {
    if (followUser && position && mapRef.current && mapExpanded) {
      mapRef.current.zoomTo(
        position.latitude,
        position.longitude,
        currentZoomLevel,
      );
    }
  }, [position, followUser, currentZoomLevel, mapExpanded]);

  const handleMapReady = React.useCallback(() => {
    if (followUser && position && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.zoomTo(
          position.latitude,
          position.longitude,
          currentZoomLevel,
        );
      }, 300);
    }
  }, [followUser, position, currentZoomLevel]);

  let durationMin = routeData ? Math.ceil(routeData.duration) : 12;
  let distanceKm = routeData ? (routeData.distance / 1000).toFixed(1) : "4.8";

  let currentPercentage = 100;
  let stepPercentage = 15;
  let currentInstruction = {
    distanceText: "",
    actionText: "",
    highlightText: "",
    icon: "turn-right" as any,
  };
  let nextInstruction = {
    text: "",
    icon: "straight" as any,
  };
  let activeSectionIndex = 0;
  let activeSectionCoordIndex = 0;
  let minGlobalDistance = Infinity;
  let allSections: any[] = [];

  if (routeData?.rawJourney?.sections) {
    if (!routeData._distancesCalculated) {
      routeData.rawJourney.sections.forEach((sec: any) => {
        if (!sec.distance && sec.geojson?.coordinates && sec.geojson.coordinates.length > 1) {
          let secDist = 0;
          const coords = sec.geojson.coordinates;
          for (let j = 0; j < coords.length - 1; j++) {
            secDist += getDistanceMetres(coords[j][1], coords[j][0], coords[j+1][1], coords[j+1][0]);
          }
          sec.distance = Math.round(secDist);
        }
      });
      routeData._distancesCalculated = true;
    }

    const sections = routeData.rawJourney.sections;
    allSections = sections;
    if (position) {
      sections.forEach((sec: any, idx: number) => {
        if (
          sec.geojson &&
          sec.geojson.coordinates &&
          sec.geojson.coordinates.length > 0
        ) {
          sec.geojson.coordinates.forEach(
            (coord: [number, number], cIdx: number) => {
              const dist = getDistanceMetres(
                position.latitude,
                position.longitude,
                coord[1],
                coord[0],
              );
              if (dist < minGlobalDistance) {
                minGlobalDistance = dist;
                activeSectionIndex = idx;
                activeSectionCoordIndex = cIdx;
              }
            },
          );
        } else if (sec.from?.coord) {
          const dist = getDistanceMetres(
            position.latitude,
            position.longitude,
            sec.from.coord.lat,
            sec.from.coord.lon,
          );
          if (dist < minGlobalDistance) {
            minGlobalDistance = dist;
            activeSectionIndex = idx;
            activeSectionCoordIndex = 0;
          }
        }
      });
      const currentSec = sections[activeSectionIndex];
      if (
        currentSec &&
        currentSec.to?.coord &&
        activeSectionIndex < sections.length - 1
      ) {
        const distToEnd = getDistanceMetres(
          position.latitude,
          position.longitude,
          currentSec.to.coord.lat,
          currentSec.to.coord.lon,
        );
        if (distToEnd < 40) {
          activeSectionIndex++;
          activeSectionCoordIndex = 0;
        }
      }
    }

    const activeSections = sections.slice(activeSectionIndex);

    if (activeSections.length > 0) {
      const firstSection = activeSections[0];
      isWalking = firstSection.type !== "public_transport" && firstSection.type !== "waiting";
      if (firstSection.type === "waiting") {
        currentInstruction = {
          distanceText: t("transit.action.waiting"),
          actionText: t("transit.action.waitMin", { time: Math.ceil((firstSection.duration || 0) / 60) }),
          highlightText: t("transit.highlight.forTransit"),
          icon: "schedule",
        };
        currentZoomLevel = 15;
        if (
          activeSections.length > 1 &&
          activeSections[1].type === "public_transport"
        ) {
          const pt = activeSections[1];
          currentInstruction.actionText = t("transit.action.waitForMode", { time: Math.ceil((firstSection.duration || 0) / 60), mode: pt.display_informations?.physical_mode || t("transit.bus") });
          currentInstruction.highlightText = t("transit.highlight.direction", { code: pt.display_informations?.code || "", direction: pt.display_informations?.direction || "" });
        }
      } else if (firstSection.type === "public_transport") {
        let remainingStops = 0;
        if (
          firstSection.stop_date_times &&
          firstSection.stop_date_times.length > 0
        ) {
          let minStopDist = Infinity;
          let closestStopIdx = 0;
          firstSection.stop_date_times.forEach((stop: any, sIdx: number) => {
            if (stop.stop_point?.coord) {
              const d = getDistanceMetres(
                position?.latitude || 0,
                position?.longitude || 0,
                stop.stop_point.coord.lat,
                stop.stop_point.coord.lon,
              );
              if (d < minStopDist) {
                minStopDist = d;
                closestStopIdx = sIdx;
              }
            }
          });
          remainingStops = Math.max(
            0,
            firstSection.stop_date_times.length - closestStopIdx - 1,
          );
        }

        const modeName =
          firstSection.display_informations?.physical_mode || t("transit.bus");
        const codeName = firstSection.display_informations?.code || "";

        if (activeSectionCoordIndex === 0) {
          currentInstruction = {
            distanceText: t("transit.action.takeTransit"),
            actionText: t("transit.action.takeMode", { mode: modeName }),
            highlightText: t("transit.highlight.direction", { code: codeName, direction: firstSection.display_informations?.direction || "" }),
            icon: "directions-bus",
          };
        } else {
          if (
            firstSection.stop_date_times &&
            firstSection.stop_date_times.length > 0
          ) {
            if (remainingStops >= 4) {
              currentInstruction = {
                distanceText: t("transit.action.inTransitStops", { count: remainingStops }),
                actionText: t("transit.action.onMode", { mode: modeName, code: codeName }),
                highlightText: t("transit.highlight.relaxStops", { count: remainingStops }),
                icon: "directions-bus",
              };
            } else if (remainingStops > 0 && remainingStops <= 3) {
              currentInstruction = {
                distanceText: t("transit.action.getReady"),
                actionText: t("transit.action.prepareOff"),
                highlightText: t("transit.highlight.stops", { count: remainingStops }),
                icon: "transfer-within-a-station",
              };
            } else {
              currentInstruction = {
                distanceText: t("transit.action.arrivingSoon"),
                actionText: t("transit.action.getOffNext"),
                highlightText: firstSection.to?.name || "",
                icon: "directions-bus",
              };
            }
          } else {
            let remainingMin = 0;
            if (
              firstSection.geojson?.coordinates &&
              firstSection.geojson.coordinates.length > 1
            ) {
              const progressRatio =
                activeSectionCoordIndex /
                (firstSection.geojson.coordinates.length - 1);
              const remainingSec =
                (firstSection.duration || 0) * Math.max(0, 1 - progressRatio);
              remainingMin = Math.ceil(remainingSec / 60);
            } else {
              remainingMin = Math.ceil((firstSection.duration || 0) / 60);
            }

            if (remainingMin > 5) {
              currentInstruction = {
                distanceText: t("transit.action.inTransitMin", { time: remainingMin }),
                actionText: t("transit.action.onMode", { mode: modeName, code: codeName }),
                highlightText: t("transit.highlight.relaxMin", { time: remainingMin }),
                icon: "directions-bus",
              };
            } else if (remainingMin > 0 && remainingMin <= 5) {
              currentInstruction = {
                distanceText: t("transit.action.getReady"),
                actionText: t("transit.action.prepareOff"),
                highlightText: t("transit.highlight.min", { time: remainingMin }),
                icon: "transfer-within-a-station",
              };
            } else {
              currentInstruction = {
                distanceText: t("transit.action.arrivingSoon"),
                actionText: t("transit.action.getOffNext"),
                highlightText: firstSection.to?.name || "",
                icon: "directions-bus",
              };
            }
          }
        }
        currentZoomLevel = 14;
      } else {
        let dist = firstSection.distance || 0;
        if (position && firstSection.to?.coord) {
          dist = Math.round(
            getDistanceMetres(
              position.latitude,
              position.longitude,
              firstSection.to.coord.lat,
              firstSection.to.coord.lon,
            ),
          );
        }
        currentInstruction = {
          distanceText: t("transit.action.inMeters", { distance: dist }),
          actionText: t("transit.action.walkTo"),
          highlightText: firstSection.to?.name || t("transit.yourDestination"),
          icon: "directions-walk",
        };
        currentZoomLevel = 18;
      }

      if (activeSections.length > 1) {
        const nextSec = activeSections[1];
        if (nextSec.type === "waiting") {
          if (
            activeSections.length > 2 &&
            activeSections[2].type === "public_transport"
          ) {
            const pt = activeSections[2];
            nextInstruction = {
              text: t("transit.next.waitMode", { time: Math.ceil((nextSec.duration || 0) / 60), mode: pt.display_informations?.physical_mode || t("transit.bus"), code: pt.display_informations?.code || "" }),
              icon: "schedule",
            };
          } else {
            nextInstruction = {
              text: t("transit.next.wait", { time: Math.ceil((nextSec.duration || 0) / 60) }),
              icon: "schedule",
            };
          }
        } else if (nextSec.type === "public_transport") {
          nextInstruction = {
            text: t("transit.next.takeMode", { mode: nextSec.display_informations?.physical_mode || t("transit.bus"), code: nextSec.display_informations?.code || "", direction: nextSec.display_informations?.direction || "" }),
            icon: "directions-transit",
          };
        } else {
          nextInstruction = {
            text: t("transit.next.walk", { time: Math.ceil((nextSec.duration || 0) / 60) }),
            icon: "directions-walk",
          };
        }
      } else {
        nextInstruction = {
          text: t("transit.next.arrive"),
          icon: "place",
        };
      }
    }
  }

  if (routeData && position) {
    const sections = routeData.rawJourney?.sections || [];
    let remainingDist = 0;
    let remainingSeconds = 0;

    for (let i = activeSectionIndex + 1; i < sections.length; i++) {
      remainingDist += sections[i].distance || 0;
      remainingSeconds += sections[i].duration || 0;
    }

    const firstSec = sections[activeSectionIndex];
    let activeSectionDist = 0;

    if (firstSec) {
      if (
        firstSec.geojson?.coordinates &&
        firstSec.geojson.coordinates.length > 1
      ) {
        const coords = firstSec.geojson.coordinates;
        let smoothIndex = activeSectionCoordIndex;

        if (activeSectionCoordIndex < coords.length - 1) {
          const current = coords[activeSectionCoordIndex];
          const next = coords[activeSectionCoordIndex + 1];
          const dToCurrent = getDistanceMetres(
            position.latitude,
            position.longitude,
            current[1],
            current[0],
          );
          const dToNext = getDistanceMetres(
            position.latitude,
            position.longitude,
            next[1],
            next[0],
          );
          const segLen = getDistanceMetres(
            current[1],
            current[0],
            next[1],
            next[0],
          );

          if (segLen > 0) {
            const fraction = Math.max(
              0,
              Math.min(1, (segLen + dToCurrent - dToNext) / (2 * segLen)),
            );
            smoothIndex += fraction;
          }
        }

        stepPercentage = Math.max(
          0,
          Math.min(100, Math.round((smoothIndex / (coords.length - 1)) * 100)),
        );
      } else {
        stepPercentage = 0;
      }

      if (firstSec.to?.coord) {
        if (firstSec.geojson?.coordinates && firstSec.geojson.coordinates.length > 1 && firstSec.distance) {
          activeSectionDist = firstSec.distance * Math.max(0, 1 - stepPercentage / 100);
        } else {
          activeSectionDist = getDistanceMetres(
            position.latitude,
            position.longitude,
            firstSec.to.coord.lat,
            firstSec.to.coord.lon,
          );
        }

        const originalDist = firstSec.distance || 1;
        const sectionDistRatio = Math.max(
          0,
          Math.min(1, activeSectionDist / originalDist),
        );

        if (
          firstSec.type === "public_transport" ||
          firstSec.type === "waiting"
        ) {
          remainingSeconds += firstSec.duration || 0;
        } else {
          remainingSeconds += (firstSec.duration || 0) * sectionDistRatio;
        }
      }
    }

    remainingDist += activeSectionDist;
    const totalDist = routeData.distance || 1;

    currentPercentage = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (1 - remainingSeconds / (routeData.rawJourney?.duration || 1)) * 100,
        ),
      ),
    );
    distanceKm = (remainingDist / 1000).toFixed(1);

    durationMin = Math.max(1, Math.ceil(remainingSeconds / 60));
  }

  const arrivalTime = new Date(Date.now() + durationMin * 60000);
  const arrivalTimeString = arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const mapPins: WaypointPin[] = [];
  if (routeData && routeData.coords && routeData.coords.length > 0) {
    mapPins.push({
      lat: routeData.coords[0].latitude,
      lng: routeData.coords[0].longitude,
      type: "departure",
    });
    mapPins.push({
      lat: routeData.coords[routeData.coords.length - 1].latitude,
      lng: routeData.coords[routeData.coords.length - 1].longitude,
      type: "destination",
    });
  }

  React.useEffect(() => {
    if (setInterpolationEnabled) {
      setInterpolationEnabled(isWalking);
      return () => setInterpolationEnabled(true);
    }
  }, [isWalking, setInterpolationEnabled]);

  return (
    <View className="flex-1 bg-[#0a0f14]">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <BlurView
        intensity={90}
        tint="dark"
        className="absolute top-0 w-full z-50 flex-row justify-between items-center px-6 shadow-sm border-b border-white/[0.05]"
        style={{ paddingTop: insets.top, height: 64 + insets.top }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2 rounded-full mt-auto mb-3 -ml-2"
        >
          <MaterialIcons name="arrow-back" size={24} color="#0d7ff2" />
        </TouchableOpacity>
        <Text className="font-bold tracking-tight text-xl text-white mt-auto mb-4">
          {t("transit.route")}
        </Text>
        <TouchableOpacity className="p-2 rounded-full mt-auto mb-3 -mr-2"></TouchableOpacity>
      </BlurView>
      <View
        className="flex-1"
        style={{
          paddingTop: 64 + insets.top + 32,
          paddingHorizontal: 24,
        }}
      >
        <View className="mb-6 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          <View
            className="h-full bg-[#0d7ff2] rounded-full"
            style={{ width: `${stepPercentage}%` }}
          />
        </View>
        <View className="space-y-4 mb-6 gap-4">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 rounded-2xl bg-[#0d7ff2] flex items-center justify-center shadow-lg shadow-blue-500/30">
              <MaterialIcons
                name={currentInstruction.icon}
                size={28}
                color="white"
              />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold leading-tight tracking-tight text-white">
                {currentInstruction.actionText}
                <Text className="text-[#0d7ff2]">
                  {currentInstruction.highlightText}
                </Text>
              </Text>
            </View>
          </View>

          <View className="p-4 rounded-3xl bg-[#16202a] border border-white/5 space-y-2 mt-2">
            <Text className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">
              {t("transit.nextStep")}
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-white flex-1 mr-4">
                {nextInstruction.text}
              </Text>
              <MaterialIcons
                name={nextInstruction.icon}
                size={20}
                color="rgba(255,255,255,0.2)"
              />
            </View>
          </View>
        </View>
        <View className="flex-row gap-4 mb-6">
          <View className="bg-[#16202a] p-4 rounded-3xl border border-white/5 flex-1 aspect-video justify-between">
            <View className="flex-row items-start justify-between">
              <MaterialIcons name="schedule" size={24} color="#0d7ff2" />
              <View className="bg-white/5 px-2 py-0.5 rounded-md">
                <Text className="text-xs font-bold text-white/70">{arrivalTimeString}</Text>
              </View>
            </View>
            <View>
              <Text className="text-3xl font-bold text-white">
                {durationMin}
                <Text className="text-base font-medium text-white/40">{t("transit.min")}</Text>
              </Text>
              <Text className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-1">
                {t("transit.timeRemaining")}
              </Text>
            </View>
          </View>
          <View className="bg-[#16202a] p-4 rounded-3xl border border-white/5 flex-1 aspect-video justify-between">
            <MaterialIcons name="straighten" size={24} color="#0d7ff2" />
            <View>
              <View className="flex-row items-end justify-between">
                <Text className="text-3xl font-bold text-white">
                  {distanceKm}
                  <Text className="text-base font-medium text-white/40">{t("transit.km")}</Text>
                </Text>
                <Text className="text-[#0d7ff2] font-bold text-base mb-1">
                  {currentPercentage}%
                </Text>
              </View>
              <Text className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-1">
                {t("transit.distanceRemaining")}
              </Text>
            </View>
          </View>
        </View>

        <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">
          {t("transit.tripSteps")}
        </Text>

        <ScrollView
          className="flex-1 -mx-6 px-6"
          contentContainerStyle={{ paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
        >
          {allSections
            .filter((sec) => !(sec.type === "waiting" && (sec.duration || 0) < 60))
            .map((sec: any, displayIdx: number, arr: any[]) => {
              const originalIdx = allSections.indexOf(sec);
              const isActive = originalIdx === activeSectionIndex;
              const isPast = originalIdx < activeSectionIndex;

              let icon = "directions-walk";
              let title = "";
              let subtitle = "";
              let color = "#0d7ff2";

              if (sec.type === "waiting") {
                icon = "schedule";
                title = t("transit.wait");
                subtitle = `${Math.ceil((sec.duration || 0) / 60)} ${t("transit.min")}`;
                color = "#8a8a8a";
              } else if (sec.type === "public_transport") {
                icon = sec.display_informations?.physical_mode === "Bus" ? "directions-bus" : "directions-transit";
                title = `${sec.display_informations?.physical_mode || t("transit.transport")} ${sec.display_informations?.code || ""}`;
                subtitle = t("transit.step.dir", { direction: sec.display_informations?.direction || "" });
                color = sec.display_informations?.color ? `#${sec.display_informations.color}` : "#0d7ff2";
              } else if (sec.type === "street_network" || sec.type === "transfer") {
                icon = "directions-walk";
                title = t("transit.walk");
                subtitle = `${Math.ceil((sec.duration || 0) / 60)} ${t("transit.min")}`;
                color = "#0d7ff2";
              } else {
                return null;
              }

              return (
                <View key={displayIdx} className={`flex-row items-stretch ${isPast ? "opacity-40" : ""}`}>
                  <View className="w-12 items-center mr-2">
                    <View
                      className={`w-8 h-8 rounded-full items-center justify-center ${isActive ? "border-2 border-white" : ""}`}
                      style={{ backgroundColor: color }}
                    >
                      <MaterialIcons name={icon as any} size={16} color="white" />
                    </View>
                    {displayIdx < arr.length - 1 && (
                      <View
                        className="w-1 flex-1 my-1 rounded-full"
                        style={{ backgroundColor: isPast ? "rgba(255,255,255,0.1)" : color }}
                      />
                    )}
                  </View>
                  <View className="flex-1 pb-6 pt-1">
                    <Text className={`font-bold ${isActive ? "text-white text-lg" : "text-white/80 text-base"}`}>
                      {title}
                    </Text>
                    <Text className={`text-sm ${isActive ? "text-[#0d7ff2]" : "text-white/50"}`}>
                      {subtitle}
                    </Text>
                    {(sec.from?.name || sec.to?.name) && sec.type === "public_transport" && (
                      <Text className="text-white/40 text-xs mt-1 leading-tight">
                        {sec.from?.name} ➔ {sec.to?.name}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
        </ScrollView>
      </View>
      {!mapExpanded && (
        <View className="absolute bottom-10 left-0 right-0 px-4 z-40">
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setMapExpanded(true)}
            className="w-full h-24 bg-[#1a2634] rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
          >
            <View className="absolute inset-0 opacity-60" pointerEvents="none">
              <MapSnapshot
                pins={mapPins}
                routeCoords={routeData?.coords}
                routeSections={routeData?.sections}
                lat={position?.latitude}
                lng={position?.longitude}
                heading={position?.heading || undefined}
                interactive={false}
                style={{ width: "100%", height: "100%" }}
              />
            </View>
            <View className="absolute inset-0 bg-gradient-to-t from-[#1a2634] to-transparent" />

            <View className="absolute inset-0 flex-row items-center justify-between px-6 z-10">
              <View className="flex-row items-center gap-4">
                <View className="w-10 h-10 rounded-full bg-white/10 border border-white/20 items-center justify-center backdrop-blur-md">
                  <MaterialIcons name="near-me" size={20} color="#0d7ff2" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-white tracking-wide">
                    {t("transit.livePreview")}
                  </Text>
                  <Text className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                    {t("transit.tapToExpand")}
                  </Text>
                </View>
              </View>
              <MaterialIcons
                name="keyboard-double-arrow-up"
                size={24}
                color="white"
              />
            </View>
          </TouchableOpacity>
        </View>
      )}
      {mapExpanded && (
        <View className="absolute inset-0 bg-[#0a0f14] z-[60]">
          <MapSnapshot
            ref={mapRef}
            pins={mapPins}
            routeCoords={routeData?.coords}
            routeSections={routeData?.sections}
            lat={position?.latitude}
            lng={position?.longitude}
            heading={position?.heading || undefined}
            zoom={currentZoomLevel}
            interactive={true}
            onMapReady={handleMapReady}
            className="rounded-none"
            style={{ width: "100%", height: "100%", position: "absolute" }}
          />
          <View
            className="absolute inset-0 bg-gradient-to-b from-[#0a0f14] via-transparent to-[#0a0f14]/80"
            pointerEvents="none"
          />

          <View
            className="relative z-10 px-4 pb-4"
            style={{ paddingTop: insets.top + 16 }}
          >
            <View className="bg-[#121a23]/95 border border-white/10 rounded-[32px] p-2 shadow-2xl backdrop-blur-2xl flex-row items-center gap-3">
              <View className="w-14 h-14 rounded-full bg-[#0d7ff2] flex items-center justify-center border-4 border-white/5 shadow-lg shadow-blue-500/30">
                <MaterialIcons
                  name={currentInstruction.icon}
                  size={26}
                  color="white"
                />
              </View>
              <View className="flex-1 justify-center py-1 pr-2">
                <Text className="text-[15px] font-bold leading-tight text-white mb-2" numberOfLines={2}>
                  {currentInstruction.actionText}
                  <Text className="text-white/70 font-medium">
                    {currentInstruction.highlightText}
                  </Text>
                </Text>
                <View className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <View
                    className="h-full bg-[#0d7ff2] rounded-full"
                    style={{ width: `${stepPercentage}%` }}
                  />
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setMapExpanded(false)}
                className="w-10 h-10 rounded-full bg-white/10 items-center justify-center mr-2 border border-white/10"
                activeOpacity={0.7}
              >
                <MaterialIcons name="keyboard-arrow-down" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          <MapContext.Provider
            value={{
              zoomIn: () => mapRef.current?.zoomIn(),
              zoomOut: () => mapRef.current?.zoomOut(),
              setZoom: () => {},
              panTo: (lat, lng) => mapRef.current?.panTo(lat, lng),
              zoomTo: (lat, lng, z) => mapRef.current?.zoomTo(lat, lng, z),
              followUser,
              toggleFollow: () => {
                setFollowUser(!followUser);
                if (!followUser && position) {
                  mapRef.current?.zoomTo(
                    position.latitude,
                    position.longitude,
                    currentZoomLevel,
                  );
                }
              },
              centerAndFollow: () => {
                setFollowUser(true);
                if (position) {
                  mapRef.current?.zoomTo(
                    position.latitude,
                    position.longitude,
                    currentZoomLevel,
                  );
                }
              },
            }}
          >
            <Controls />
          </MapContext.Provider>
        </View>
      )}
    </View>
  );
}
