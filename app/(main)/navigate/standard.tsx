import LaneArrow from "@/components/LaneArrow";
import { WaypointPin } from "@/components/MapSnapshot";
import ShadcnMap from "@/components/ShadcnMap";
import { useMapLayers } from "@/components/map/MapLayersContext";
import { Colors } from "@/constants/theme";
import { usePosition } from "@/contexts/PositionContext";
import { useUser } from "@/contexts/UserContext";
import {
  useTrafficAlerts,
  type TrafficAlertData,
} from "@/hooks/useTrafficAlerts";
import { createTranslator } from "@/i18n";
import type { Coordinate } from "@/services/RouteService";
import { useRouteService } from "@/services/RouteService";
import { clearActiveNavigation } from "@/utils/activeNavigation";
import { cn } from "@/utils/cn";
import { showCommingSoonToast } from "@/utils/commingSoonToast";
import { addRecentTrip } from "@/utils/recentTrips";
import { snapPointsPercent } from "@/utils/snapPoints";
import { MaterialIcons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import Constants from "expo-constants";
import * as Localization from "expo-localization";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Accelerometer } from "expo-sensors";
import * as Speech from "expo-speech";
import React from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  Vibration,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

type NavigationMode = "car" | "walk" | "bike";

const OFF_ROUTE_RECALC_DISTANCE_M = 30;
const FIRST_ON_ROUTE_TOLERANCE_M = 20;
const OFF_ROUTE_RECALC_COOLDOWN_MS = 2000;
const OFF_ROUTE_CHECK_INTERVAL_MS = 700;
const OFF_ROUTE_RECALC_ERROR_COOLDOWN_MS = 10000;
const OFF_ROUTE_RECALC_SUCCESS_COOLDOWN_MS = 5000;
const MIN_GPS_STEP_DISTANCE_M = 1;
const MAX_GPS_STEP_DISTANCE_M = 120;
const REJOIN_RECALC_DISTANCE_M = 40;

const MODE_TO_SERVICE: Record<NavigationMode, string> = {
  car: "driving",
  walk: "walking",
  bike: "bicycling",
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder
    ? `${hours}h${remainder.toString().padStart(2, "0")}`
    : `${hours}h`;
};

const formatDistance = (meters: number): string => {
  if (meters < 0) return "0 m";
  if (meters < 100) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const interpolateColor = (diff: number): string => {
  const breakpoints = [
    { diff: -20, r: 76, g: 7, b: 168 },
    { diff: -10, r: 7, g: 79, b: 168 },
    { diff: 0, r: 30, g: 179, b: 60 },
    { diff: 5, r: 30, g: 179, b: 60 },
    { diff: 10, r: 224, g: 219, b: 30 },
    { diff: 15, r: 224, g: 30, b: 30 },
  ];

  if (diff <= breakpoints[0].diff) return "#4c07a8";
  if (diff >= breakpoints[breakpoints.length - 1].diff) return "#e01e1e";

  let i = 0;
  while (i < breakpoints.length - 1 && diff > breakpoints[i + 1].diff) {
    i++;
  }

  const b1 = breakpoints[i];
  const b2 = breakpoints[i + 1];
  const t = (diff - b1.diff) / (b2.diff - b1.diff);

  const r = Math.round(b1.r + (b2.r - b1.r) * t);
  const g = Math.round(b1.g + (b2.g - b1.g) * t);
  const b = Math.round(b1.b + (b2.b - b1.b) * t);

  return `rgb(${r},${g},${b})`;
};

const calculateDistance = (a: Coordinate, b: Coordinate) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const c =
    sinDlat * sinDlat +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      sinDlon *
      sinDlon;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
};

const calculateBearing = (from: Coordinate, to: Coordinate) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLon = toRad(to.longitude - from.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return ((brng % 360) + 360) % 360;
};

const getEtaLabel = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return "";
  const arrival = new Date(Date.now() + seconds * 1000);
  return arrival.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function StandardNavigationScreen() {
  const { t } = createTranslator("navigate");
  const { t: tTraffic } = createTranslator("traffic");
  const { settings } = useUser();
  const layers = useMapLayers();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lat, lng, mode, name, multi } = useLocalSearchParams();
  const { position, lastUpdate } = usePosition();
  const positionRef = React.useRef(position);
  React.useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const routeService = useRouteService();
  const mapRef = React.useRef<any>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const [following, setFollowing] = React.useState(true);
  const { height: screenHeight } = useWindowDimensions();
  const [guideMode, setGuideMode] = React.useState<"alert" | "all" | "off">(
    settings.voice ?? "alert",
  );

  const navigationStartTrackedRef = React.useRef(false);
  React.useEffect(() => {
    if (!navigationStartTrackedRef.current && mapReady && position) {
      navigationStartTrackedRef.current = true;
    }
  }, [mapReady, position, mode]);

  const post = (obj: any) => {
    try {
      mapRef.current?.postMessage(JSON.stringify(obj));
    } catch {}
  };

  const hasCenteredRef = React.useRef(false);
  const prevPositionForBearingRef = React.useRef<Coordinate | null>(null);
  const lastKnownBearingRef = React.useRef(0);
  const hasArrivedRedirectRef = React.useRef(false);

  const handleMapMsg = React.useCallback(
    (msg: any) => {
      if (msg?.type === "mapReady") {
        setMapReady(true);
        setFollowing(true);

        if (!hasCenteredRef.current) {
          hasCenteredRef.current = true;
          (async () => {
            if (
              position &&
              Number.isFinite(position.latitude) &&
              Number.isFinite(position.longitude)
            ) {
              post({
                type: "panTo",
                lat: position.latitude,
                lng: position.longitude,
                zoom: 17,
                animate: false,
              });
            }
          })();
        }
      }
      if (msg?.type === "mapMoved") {
        setFollowing(false);
      }
    },
    [position],
  );

  const destLat = lat ? parseFloat(lat as string) : null;
  const destLng = lng ? parseFloat(lng as string) : null;
  const requestedMode = (mode as NavigationMode) ?? "car";
  const destinationName = (name as string)?.trim() ?? "";
  const serviceMode = MODE_TO_SERVICE[requestedMode] ?? MODE_TO_SERVICE.car;

  const startCoordinate: Coordinate | null = React.useMemo(() => {
    if (
      !position ||
      !Number.isFinite(position.latitude) ||
      !Number.isFinite(position.longitude)
    )
      return null;
    return { latitude: position.latitude, longitude: position.longitude };
  }, [position?.latitude, position?.longitude]);

  const fetchKey = React.useRef("");
  const autoRouteFetchedRef = React.useRef(false);
  const offRouteRecalcInFlightRef = React.useRef(false);
  const lastOffRouteRecalcAtRef = React.useRef(0);
  const lastRecalcErrorAtRef = React.useRef(0);
  const lastRecalcSuccessAtRef = React.useRef(0);
  const hasBeenOnRouteRef = React.useRef(false);
  const waitingForRouteRef = React.useRef(false);
  const lastLeftPositionRef = React.useRef<Coordinate | null>(null);
  const tripStartAtRef = React.useRef<number | null>(null);
  const tripDistanceMetersRef = React.useRef(0);
  const lastTripPointRef = React.useRef<Coordinate | null>(null);
  const lastTripUpdateTimeRef = React.useRef(0);
  const TRIP_UPDATE_INTERVAL_MS = 500;
  const [tripDurationSeconds, setTripDurationSeconds] = React.useState(0);
  const [tripDistanceMeters, setTripDistanceMeters] = React.useState(0);
  React.useEffect(() => {
    if (multi && routeService.routeCoords.length > 1) return;
    if (!startCoordinate || destLat === null || destLng === null) return;
    if (autoRouteFetchedRef.current) return;
    const key = `${startCoordinate.latitude}_${startCoordinate.longitude}_${destLat}_${destLng}_${serviceMode}`;
    if (fetchKey.current === key) return;
    fetchKey.current = key;
    autoRouteFetchedRef.current = true;
    routeService
      .getRoute(
        startCoordinate,
        { latitude: destLat, longitude: destLng },
        serviceMode,
        typeof (startCoordinate as any).heading === "number" &&
          (startCoordinate as any).heading >= 0
          ? { heading: (startCoordinate as any).heading }
          : undefined,
      )
      .catch(() => {});

    try {
      addRecentTrip({
        name: destinationName || (t("destinationFallback") as string) || "",
        address: destinationName || "",
        lat: destLat,
        lng: destLng,
      });
    } catch {}
  }, [
    startCoordinate,
    destLat,
    destLng,
    serviceMode,
    routeService,
    destinationName,
    t,
  ]);

  React.useEffect(() => {
    autoRouteFetchedRef.current = false;
    fetchKey.current = "";
    offRouteRecalcInFlightRef.current = false;
    lastOffRouteRecalcAtRef.current = 0;
    lastRecalcErrorAtRef.current = 0;
    lastRecalcSuccessAtRef.current = 0;
    hasArrivedRedirectRef.current = false;
    hasBeenOnRouteRef.current = false;
    tripStartAtRef.current = null;
    tripDistanceMetersRef.current = 0;
    lastTripPointRef.current = null;
    setTripDurationSeconds(0);
    setTripDistanceMeters(0);
  }, [destLat, destLng, serviceMode]);

  React.useEffect(() => {
    const positionLat = position?.latitude;
    const positionLng = position?.longitude;

    if (
      typeof positionLat !== "number" ||
      typeof positionLng !== "number" ||
      !Number.isFinite(positionLat) ||
      !Number.isFinite(positionLng)
    ) {
      return;
    }

    const now = Date.now();
    const currentPoint: Coordinate = {
      latitude: positionLat,
      longitude: positionLng,
    };

    if (tripStartAtRef.current === null) {
      tripStartAtRef.current = now;
      lastTripPointRef.current = currentPoint;
      return;
    }

    const prevPoint = lastTripPointRef.current;
    if (prevPoint) {
      const segmentDistance = calculateDistance(prevPoint, currentPoint);
      if (
        Number.isFinite(segmentDistance) &&
        segmentDistance >= MIN_GPS_STEP_DISTANCE_M &&
        segmentDistance <= MAX_GPS_STEP_DISTANCE_M
      ) {
        tripDistanceMetersRef.current += segmentDistance;
      }
    }

    lastTripPointRef.current = currentPoint;

    const lastUpdate = lastTripUpdateTimeRef.current || 0;
    if (now - lastUpdate >= TRIP_UPDATE_INTERVAL_MS) {
      lastTripUpdateTimeRef.current = now;
      setTripDistanceMeters(
        Math.round(Math.max(0, tripDistanceMetersRef.current)),
      );
      setTripDurationSeconds(
        Math.max(0, Math.round((now - (tripStartAtRef.current ?? now)) / 1000)),
      );
    }
  }, [position?.latitude, position?.longitude]);

  React.useEffect(() => {
    const checkOffRouteAndRecalculate = () => {
      const currentPos = positionRef.current;

      if (
        !currentPos ||
        !Number.isFinite(currentPos.latitude) ||
        !Number.isFinite(currentPos.longitude) ||
        destLat === null ||
        destLng === null ||
        routeService.routeCoords.length < 2
      ) {
        return;
      }

      if (offRouteRecalcInFlightRef.current || routeService.isCalculating) {
        return;
      }

      const distanceToRoute = routeService.getDistanceToRoute({
        latitude: currentPos.latitude,
        longitude: currentPos.longitude,
      });

      if (!Number.isFinite(distanceToRoute)) {
        return;
      }

      if (
        currentPos.speed !== undefined &&
        currentPos.speed !== null &&
        currentPos.speed < 1.0 &&
        distanceToRoute < 50
      ) {
        return;
      }

      if (!hasBeenOnRouteRef.current) {
        if (distanceToRoute <= FIRST_ON_ROUTE_TOLERANCE_M) {
          hasBeenOnRouteRef.current = true;
        } else {
          return;
        }
      }

      if (distanceToRoute <= OFF_ROUTE_RECALC_DISTANCE_M) {
        if (waitingForRouteRef.current) {
          waitingForRouteRef.current = false;
          lastLeftPositionRef.current = null;
        }
        return;
      }

      const now = Date.now();
      if (
        now - lastRecalcErrorAtRef.current <
        OFF_ROUTE_RECALC_ERROR_COOLDOWN_MS
      ) {
        return;
      }
      if (
        now - lastRecalcSuccessAtRef.current <
        OFF_ROUTE_RECALC_SUCCESS_COOLDOWN_MS
      ) {
        return;
      }
      if (
        now - lastOffRouteRecalcAtRef.current <
        OFF_ROUTE_RECALC_COOLDOWN_MS
      ) {
        return;
      }

      const currentlyOnRoute = routeService.isOnRoute(
        currentPos,
        FIRST_ON_ROUTE_TOLERANCE_M,
      );

      if (!currentlyOnRoute) {
        if (!waitingForRouteRef.current) {
          waitingForRouteRef.current = true;
          lastLeftPositionRef.current = currentPos;
          lastOffRouteRecalcAtRef.current = now;

          offRouteRecalcInFlightRef.current = true;
          lastOffRouteRecalcAtRef.current = now;

          const performRecalc = async () => {
            try {
              let ok = false;
              if (routeService.recalculateIfOffRoute) {
                const heading = (currentPos as any).heading;
                const opts =
                  typeof heading === "number" && heading >= 0
                    ? { heading }
                    : undefined;
                const res = await routeService.recalculateIfOffRoute(
                  currentPos,
                  serviceMode,
                  opts,
                );
                ok = res !== false && res !== null && res !== undefined;
              } else {
                const res = await routeService.getRoute(
                  {
                    latitude: currentPos.latitude,
                    longitude: currentPos.longitude,
                  },
                  { latitude: destLat, longitude: destLng },
                  serviceMode,
                  typeof (currentPos as any).heading === "number" &&
                    (currentPos as any).heading >= 0
                    ? { heading: (currentPos as any).heading }
                    : undefined,
                );
                ok = !!res;
              }

              if (!ok) {
                lastRecalcErrorAtRef.current = Date.now();
              } else {
                lastRecalcSuccessAtRef.current = Date.now();
                waitingForRouteRef.current = false;
                lastLeftPositionRef.current = null;

                try {
                  if (mapReady && routeService.routeCoords.length >= 2) {
                    post({
                      type: "setPolyline",
                      latlngs: routeService.routeCoords.map((c) => [
                        c.latitude,
                        c.longitude,
                      ]),
                      color: "#0d7ff2",
                      weight: 3,
                      opacity: 0.8,
                    });
                  }
                } catch {}
              }
            } catch {
              lastRecalcErrorAtRef.current = Date.now();
            } finally {
              offRouteRecalcInFlightRef.current = false;
            }
          };

          performRecalc();
        } else {
          if (
            now - lastOffRouteRecalcAtRef.current >
            OFF_ROUTE_RECALC_COOLDOWN_MS
          ) {
            if (routeService.isCalculating || offRouteRecalcInFlightRef.current)
              return;

            offRouteRecalcInFlightRef.current = true;
            lastOffRouteRecalcAtRef.current = now;

            const performRecalc = async () => {
              try {
                let ok = false;
                if (routeService.recalculateIfOffRoute) {
                  const heading = (currentPos as any).heading;
                  const opts =
                    typeof heading === "number" && heading >= 0
                      ? { heading }
                      : undefined;
                  const res = await routeService.recalculateIfOffRoute(
                    currentPos,
                    serviceMode,
                    opts,
                  );
                  ok = res !== false && res !== null && res !== undefined;
                } else {
                  const res = await routeService.getRoute(
                    {
                      latitude: currentPos.latitude,
                      longitude: currentPos.longitude,
                    },
                    { latitude: destLat, longitude: destLng },
                    serviceMode,
                    typeof (currentPos as any).heading === "number" &&
                      (currentPos as any).heading >= 0
                      ? { heading: (currentPos as any).heading }
                      : undefined,
                  );
                  ok = !!res;
                }

                if (!ok) {
                  lastRecalcErrorAtRef.current = Date.now();
                } else {
                  lastRecalcSuccessAtRef.current = Date.now();
                  waitingForRouteRef.current = false;
                  lastLeftPositionRef.current = null;

                  try {
                    if (mapReady && routeService.routeCoords.length >= 2) {
                      post({
                        type: "setPolyline",
                        latlngs: routeService.routeCoords.map((c) => [
                          c.latitude,
                          c.longitude,
                        ]),
                        color: "#0d7ff2",
                        weight: 3,
                        opacity: 0.8,
                      });
                    }
                  } catch {}
                }
              } catch {
                lastRecalcErrorAtRef.current = Date.now();
              } finally {
                offRouteRecalcInFlightRef.current = false;
              }
            };

            performRecalc();
          }
        }

        return;
      }

      if (waitingForRouteRef.current) {
        const left = lastLeftPositionRef.current;
        waitingForRouteRef.current = false;
        lastLeftPositionRef.current = null;
        if (left) {
          const movedSinceLeft = calculateDistance(left, currentPos);
          if (movedSinceLeft <= REJOIN_RECALC_DISTANCE_M) {
            return;
          }
        }
      }
    };

    checkOffRouteAndRecalculate();
    const intervalId = setInterval(
      checkOffRouteAndRecalculate,
      OFF_ROUTE_CHECK_INTERVAL_MS,
    );

    return () => {
      clearInterval(intervalId);
    };
  }, [
    destLat,
    destLng,
    serviceMode,
    routeService,
    routeService.routeCoords,
    routeService.isCalculating,
    mapReady,
  ]);

  const sheetRef = React.useRef<BottomSheet>(null);
  const mainSheetHeights = React.useMemo(() => [200, 460], []);
  const snapPoints = React.useMemo(
    () => snapPointsPercent(mainSheetHeights, screenHeight),
    [mainSheetHeights, screenHeight],
  );
  const [mainSheetIndex, setMainSheetIndex] = React.useState(0);
  const speedPanelBottom = React.useRef(
    new Animated.Value(mainSheetHeights[0] + 20),
  ).current;

  const animateSpeedPanelToIndex = React.useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, mainSheetHeights.length - 1));
      const target = (mainSheetHeights[clamped] ?? mainSheetHeights[0]) + 20;

      Animated.timing(speedPanelBottom, {
        toValue: target,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [mainSheetHeights, speedPanelBottom],
  );

  const baseLayer = layers.mapType;
  const themeMode: "dark" | "light" = layers.darkTheme ? "dark" : "light";
  const [speedLimit, setSpeedLimit] = React.useState<string | null>(null);
  const isCarMode = requestedMode === "car";
  const [showStepsSheet, setShowStepsSheet] = React.useState(false);
  const stepsSheetRef = React.useRef<BottomSheet>(null);
  const stepsSnapPoints = React.useMemo(
    () => snapPointsPercent([400, 600], screenHeight),
    [screenHeight],
  );

  React.useEffect(() => {
    if (!mapReady) return;
    post({ type: "setBaseLayer", layer: baseLayer, theme: themeMode });
  }, [baseLayer, themeMode, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const shouldShowTraffic = isCarMode && settings.trafficAlerts !== false;
    post({ type: "setTraffic", enabled: shouldShowTraffic });
  }, [mapReady, isCarMode, settings.trafficAlerts]);

  const handleStopTrip = () => {
    routeService.clearRoute();
    clearActiveNavigation();
    router.back();
  };

  const handleRoutes = async () => {
    setShowStepsSheet(true);
  };

  const [activeTrafficAlert, setActiveTrafficAlert] =
    React.useState<TrafficAlertData | null>(null);
  const alertAnim = React.useRef(new Animated.Value(0)).current;
  const alertDismissTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const showAlert = React.useCallback(
    (alert: TrafficAlertData) => {
      setActiveTrafficAlert(alert);
      Vibration.vibrate([0, 80, 60, 40]);
      alertAnim.setValue(0);
      Animated.spring(alertAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 9,
      }).start();

      if (alertDismissTimer.current) clearTimeout(alertDismissTimer.current);
      alertDismissTimer.current = setTimeout(() => {
        dismissAlert();
      }, 20000);
    },
    [alertAnim],
  );

  const dismissAlert = React.useCallback(() => {
    Animated.timing(alertAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setActiveTrafficAlert(null));
    if (alertDismissTimer.current) {
      clearTimeout(alertDismissTimer.current);
      alertDismissTimer.current = null;
    }
  }, [alertAnim]);

  React.useEffect(() => {
    return () => {
      if (alertDismissTimer.current) clearTimeout(alertDismissTimer.current);
      if (hazardDismissTimer.current) clearTimeout(hazardDismissTimer.current);
    };
  }, []);

  const [activeHazardAlert, setActiveHazardAlert] = React.useState<any | null>(
    null,
  );
  const hazardAlertAnim = React.useRef(new Animated.Value(0)).current;
  const hazardDismissTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const dismissHazardAlert = React.useCallback(() => {
    Animated.timing(hazardAlertAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setActiveHazardAlert(null));
    if (hazardDismissTimer.current) {
      clearTimeout(hazardDismissTimer.current);
      hazardDismissTimer.current = null;
    }
  }, [hazardAlertAnim]);

  const showHazardAlert = React.useCallback(
    (hazard: any) => {
      setActiveHazardAlert(hazard);
      Vibration.vibrate([0, 80, 60, 40]);
      hazardAlertAnim.setValue(0);
      Animated.spring(hazardAlertAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 9,
      }).start();

      if (hazardDismissTimer.current) clearTimeout(hazardDismissTimer.current);
      hazardDismissTimer.current = setTimeout(() => {
        dismissHazardAlert();
      }, 10000);
    },
    [hazardAlertAnim, dismissHazardAlert],
  );

  const dismissedHazardsRef = React.useRef<Set<number>>(new Set());

  const distanceM = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const p = 0.017453292519943295;
    const c = Math.cos;
    const a =
      0.5 -
      c((lat2 - lat1) * p) / 2 +
      (c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))) / 2;
    return 12742000 * Math.asin(Math.sqrt(a));
  };

  const navigationData = routeService.getNavigationData();

  React.useEffect(() => {
    if (!position || !navigationData?.routeData?.routes?.[0]?.hazards) return;
    const hazards = navigationData.routeData.routes[0].hazards;
    for (const h of hazards) {
      if (dismissedHazardsRef.current.has(h.id)) continue;
      const dist = distanceM(
        position.latitude,
        position.longitude,
        h.lat,
        h.lon,
      );
      if (dist < 200) {
        showHazardAlert({ ...h, distance: Math.round(dist) });
        dismissedHazardsRef.current.add(h.id);
        break;
      }
    }
  }, [position, navigationData?.routeData?.routes, showHazardAlert]);

  React.useEffect(() => {
    if (mapReady && navigationData?.routeData?.routes?.[0]?.hazards) {
      mapRef.current?.postMessage(
        JSON.stringify({
          type: "setHazards",
          hazards: navigationData.routeData.routes[0].hazards,
        }),
      );
    } else if (mapReady) {
      mapRef.current?.postMessage(
        JSON.stringify({ type: "setHazards", hazards: [] }),
      );
    }
  }, [mapReady, navigationData?.routeData?.routes]);

  const routeNamesInNextHour = React.useMemo(() => {
    if (!navigationData?.steps) return [];
    const ROUTE_REGEX = /\b([ANE])\s*(\d{1,4})\b/g;
    const names = new Set<string>();
    let cumulativeDuration = 0;

    for (const step of navigationData.steps) {
      if (cumulativeDuration > 3600) break;
      cumulativeDuration += step.duration || 0;

      const stepName = step.name?.trim() || "";
      const stepRef = step.ref?.trim() || "";

      if (stepName !== "" || stepRef !== "") {
        const textToSearch = `${stepName} ${stepRef}`;
        const matches = Array.from(textToSearch.matchAll(ROUTE_REGEX));

        if (matches.length > 0) {
          for (const match of matches) {
            const prefix = match[1].toUpperCase();
            const numStr = match[2].padStart(4, "0");
            names.add(`${prefix}${numStr}`);
          }
        } else if (stepName !== "") {
          names.add(stepName);
        } else if (stepRef !== "") {
          names.add(stepRef);
        }
      }
    }
    return Array.from(names);
  }, [navigationData?.steps]);

  const currentStepIndex = React.useMemo(() => {
    if (!navigationData?.steps || !position) return 0;
    let bestStepIdx = 0;
    let minDistance = Infinity;

    navigationData.steps.forEach((step, idx) => {
      if (!step.coordinates) return;
      for (const [lng, lat] of step.coordinates) {
        const d = calculateDistance(
          { latitude: position.latitude, longitude: position.longitude },
          { latitude: lat, longitude: lng },
        );
        if (d < minDistance) {
          minDistance = d;
          bestStepIdx = idx;
        }
      }
    });
    return bestStepIdx;
  }, [navigationData?.steps, position?.latitude, position?.longitude]);

  const approachingStepIndex = Math.min(
    currentStepIndex + 1,
    (navigationData?.steps?.length || 1) - 1,
  );
  const approachingStep = navigationData?.steps?.[approachingStepIndex];

  const distanceToNextManeuver = React.useMemo(() => {
    if (!approachingStep?.maneuver?.location || !position) return 0;
    const mLoc = approachingStep.maneuver.location;
    return calculateDistance(
      { latitude: position.latitude, longitude: position.longitude },
      { latitude: mLoc[1], longitude: mLoc[0] },
    );
  }, [approachingStep, position?.latitude, position?.longitude]);

  const timeToNextManeuver = React.useMemo(() => {
    if (
      !approachingStep ||
      !approachingStep.distance ||
      !approachingStep.duration
    )
      return 0;
    const ratio = distanceToNextManeuver / approachingStep.distance;
    return approachingStep.duration * ratio;
  }, [approachingStep, distanceToNextManeuver]);

  const remainingDistance = React.useMemo(() => {
    if (!navigationData?.steps) return navigationData?.totalDistance ?? 0;
    let dist = Math.max(0, distanceToNextManeuver);
    for (
      let i = approachingStepIndex + 1;
      i < navigationData.steps.length;
      i++
    ) {
      dist += navigationData.steps[i].distance || 0;
    }
    return dist;
  }, [navigationData?.steps, approachingStepIndex, distanceToNextManeuver]);

  const remainingDuration = React.useMemo(() => {
    if (!navigationData?.steps) return navigationData?.totalDuration ?? 0;
    let dur = Math.max(0, timeToNextManeuver);
    for (
      let i = approachingStepIndex + 1;
      i < navigationData.steps.length;
      i++
    ) {
      dur += navigationData.steps[i].duration || 0;
    }
    return dur;
  }, [navigationData?.steps, approachingStepIndex, timeToNextManeuver]);

  const { dismissActiveAlert, activeTrafficAlerts } = useTrafficAlerts({
    enabled: isCarMode && settings.trafficAlerts !== false,
    isCarMode,
    routeNamesInNextHour,
    currentPosition: position
      ? { latitude: position.latitude, longitude: position.longitude }
      : null,
    remainingDurationSeconds: remainingDuration,
    activeAlertId: activeTrafficAlert?.ID ?? null,
    onAlert: showAlert,
    onDismiss: dismissAlert,
  });

  const combinedStepsData = React.useMemo(() => {
    const rawSteps = navigationData?.steps || [];
    if (!activeTrafficAlerts || activeTrafficAlerts.length === 0) {
      return rawSteps.map((step, index) => ({
        type: "step",
        data: step,
        originalIndex: index,
      }));
    }

    const alertsByStep = new Map<number, TrafficAlertData[]>();

    activeTrafficAlerts.forEach((alert) => {
      let closestStepIdx = -1;
      let minDistance = Infinity;

      rawSteps.forEach((step, idx) => {
        if (!step.coordinates) return;
        for (const coord of step.coordinates) {
          const d = calculateDistance(
            { latitude: coord[1], longitude: coord[0] },
            { latitude: alert.Lat, longitude: alert.Lon },
          );
          if (d < minDistance) {
            minDistance = d;
            closestStepIdx = idx;
          }
        }
      });

      if (closestStepIdx !== -1 && minDistance < 1000) {
        const existing = alertsByStep.get(closestStepIdx) || [];
        alertsByStep.set(closestStepIdx, [...existing, alert]);
      }
    });

    const result: any[] = [];
    rawSteps.forEach((step, idx) => {
      result.push({ type: "step", data: step, originalIndex: idx });
      const stepAlerts = alertsByStep.get(idx);
      if (stepAlerts) {
        stepAlerts.forEach((alert) => {
          result.push({ type: "alert", data: alert });
        });
      }
    });

    return result;
  }, [navigationData?.steps, activeTrafficAlerts]);

  const totalDuration = remainingDuration;
  const totalDistance = remainingDistance;
  const reliableDurationForSummary = React.useMemo(() => {
    const navDuration = Math.max(0, Math.round(totalDuration));
    const tripDuration = Math.max(0, Math.round(tripDurationSeconds));
    return tripDuration > 0 ? Math.max(tripDuration, navDuration) : navDuration;
  }, [totalDuration, tripDurationSeconds]);
  const reliableDistanceForSummary = React.useMemo(() => {
    const navDistance = Math.max(0, Math.round(totalDistance));
    const tripDistance = Math.max(0, Math.round(tripDistanceMeters));
    return tripDistance > 0 ? Math.max(tripDistance, navDistance) : navDistance;
  }, [totalDistance, tripDistanceMeters]);
  const etaLabel = getEtaLabel(totalDuration);

  React.useEffect(() => {
    if (hasArrivedRedirectRef.current) return;
    if (
      !position ||
      !Number.isFinite(position.latitude) ||
      !Number.isFinite(position.longitude) ||
      destLat === null ||
      destLng === null
    ) {
      return;
    }

    const isLastStep =
      currentStepIndex ===
      Math.max(0, (navigationData?.steps?.length || 1) - 1);
    if (!isLastStep) return;

    const distanceToDestination = calculateDistance(
      { latitude: position.latitude, longitude: position.longitude },
      { latitude: destLat, longitude: destLng },
    );

    let distanceThreshold = 50;
    if (requestedMode === "walk" || requestedMode === "bike") {
      distanceThreshold = 10;
    }

    if (distanceToDestination > distanceThreshold) return;

    hasArrivedRedirectRef.current = true;

    const averageSpeedKmh =
      reliableDurationForSummary > 0
        ? (reliableDistanceForSummary / reliableDurationForSummary) * 3.6
        : Math.max(0, (position.speed ?? 0) * 3.6);

    const startLatParam =
      startCoordinate?.latitude ??
      (Number.isFinite(position.latitude) ? position.latitude : destLat);
    const startLngParam =
      startCoordinate?.longitude ??
      (Number.isFinite(position.longitude) ? position.longitude : destLng);

    routeService.clearRoute();
    router.replace({
      pathname: "/(main)/arrived" as any,
      params: {
        name: destinationName || t("destinationFallback"),
        mode: requestedMode,
        totalDuration: String(reliableDurationForSummary),
        totalDistance: String(reliableDistanceForSummary),
        avgSpeed: String(Math.round(averageSpeedKmh)),
        startLat: String(startLatParam),
        startLng: String(startLngParam),
        destLat: String(destLat),
        destLng: String(destLng),
      },
    });
  }, [
    requestedMode,
    position,
    destLat,
    destLng,
    reliableDurationForSummary,
    reliableDistanceForSummary,
    destinationName,
    startCoordinate?.latitude,
    startCoordinate?.longitude,
    routeService,
    router,
    t,
    currentStepIndex,
    navigationData?.steps?.length,
  ]);

  const currentSpeedKmH = (position?.speed ?? 0) * 3.6;
  const limitNum = isCarMode && speedLimit ? parseInt(speedLimit, 10) : null;

  const targetZoom = React.useMemo(() => {
    const speedRef =
      limitNum !== null ? Math.max(limitNum, currentSpeedKmH) : currentSpeedKmH;

    let baseZoom = 17.5;
    if (speedRef > 30) {
      if (speedRef >= 130) {
        baseZoom = 14.0;
      } else {
        baseZoom = 17.5 - (speedRef - 30) * 0.035;
      }
    }

    if (approachingStep && distanceToNextManeuver < 400) {
      const intersectionZoom = Math.min(18.5, baseZoom + 1.2);
      const progress = 1 - distanceToNextManeuver / 400;
      baseZoom = baseZoom + (intersectionZoom - baseZoom) * progress;
    }

    let maxLayerZoom = 19;
    if (baseLayer === "terrain") maxLayerZoom = 17;

    return Math.min(baseZoom, maxLayerZoom);
  }, [
    distanceToNextManeuver,
    approachingStep,
    baseLayer,
    currentSpeedKmH,
    limitNum,
  ]);

  const currentPitchRef = React.useRef(45);

  const isDeadReckoningRef = React.useRef(false);
  const [isSimulated, setIsSimulated] = React.useState(false);
  const deadReckoningSpeedRef = React.useRef(0);
  const simulatedPositionRef = React.useRef<Coordinate | null>(null);

  React.useEffect(() => {
    if (
      position?.speed !== undefined &&
      position?.speed !== null &&
      !isDeadReckoningRef.current
    ) {
      deadReckoningSpeedRef.current = position.speed;
    }
  }, [position]);

  React.useEffect(() => {
    let subscription: any;
    Accelerometer.setUpdateInterval(200);
    subscription = Accelerometer.addListener(({ x, y, z }) => {
      if (z > 0.15 || y < -0.15) {
        deadReckoningSpeedRef.current = Math.max(
          0,
          deadReckoningSpeedRef.current - 0.5,
        );
      }

      if (isDeadReckoningRef.current) {
        if (z < -0.15 || y > 0.15) {
          deadReckoningSpeedRef.current += 0.5;
        }
      }
    });
    return () => subscription?.remove();
  }, []);

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (!position) return;
      const now = Date.now();
      const timeSinceGps = now - lastUpdate;

      if (timeSinceGps > 5000 && deadReckoningSpeedRef.current > 2.0) {
        if (!isDeadReckoningRef.current) {
          isDeadReckoningRef.current = true;
          setIsSimulated(true);
          simulatedPositionRef.current = {
            latitude: position.latitude,
            longitude: position.longitude,
          };
        }

        const currentSimPos = simulatedPositionRef.current;
        if (currentSimPos && routeService.routeCoords.length > 0) {
          let closestIdx = 0;
          let minD = Infinity;
          routeService.routeCoords.forEach((c, idx) => {
            const d = calculateDistance(currentSimPos, c);
            if (d < minD) {
              minD = d;
              closestIdx = idx;
            }
          });

          const dt = 0.5;
          const distanceToMove = deadReckoningSpeedRef.current * dt;

          if (closestIdx < routeService.routeCoords.length - 1) {
            const nextCoord = routeService.routeCoords[closestIdx + 1];
            const segmentD = calculateDistance(currentSimPos, nextCoord);

            let newLat, newLng;
            if (segmentD <= distanceToMove || segmentD === 0) {
              newLat = nextCoord.latitude;
              newLng = nextCoord.longitude;
            } else {
              const ratio = distanceToMove / segmentD;
              newLat =
                currentSimPos.latitude +
                (nextCoord.latitude - currentSimPos.latitude) * ratio;
              newLng =
                currentSimPos.longitude +
                (nextCoord.longitude - currentSimPos.longitude) * ratio;
            }
            simulatedPositionRef.current = {
              latitude: newLat,
              longitude: newLng,
            };

            const bearing = calculateBearing(currentSimPos, {
              latitude: newLat,
              longitude: newLng,
            });
            const speedKmh = deadReckoningSpeedRef.current * 3.6;

            if (following) {
              post({
                type: "panTo",
                lat: newLat,
                lng: newLng,
                zoom: targetZoom,
                bearing: bearing,
                pitch: speedKmh > 50 ? 45 : 0,
                offsetY: 140,
                animate: true,
                duration: 0.5,
              });
            }
            post({
              type: "setUserMarker",
              lat: newLat,
              lng: newLng,
              heading: bearing,
              icon: "circle",
              animate: true,
            });
          }
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [lastUpdate, position, routeService.routeCoords, targetZoom, following]);

  React.useEffect(() => {
    if (!position) return;
    const now = Date.now();
    const timeSinceGps = now - lastUpdate;
    if (isDeadReckoningRef.current && timeSinceGps <= 5000) {
      isDeadReckoningRef.current = false;
      setIsSimulated(false);
      if (following) {
        post({
          type: "panTo",
          lat: position.latitude,
          lng: position.longitude,
          zoom: targetZoom,
          animate: true,
          duration: 0.5,
        });
      }
    }
  }, [lastUpdate, position, following, targetZoom]);

  const lastCameraZoomRef = React.useRef<number | null>(null);
  const targetSpeedDiff = React.useMemo(() => {
    if (limitNum === null) return 0;
    return Math.max(-20, Math.min(15, currentSpeedKmH - limitNum));
  }, [currentSpeedKmH, limitNum]);
  const [smoothedSpeedDiff, setSmoothedSpeedDiff] =
    React.useState(targetSpeedDiff);
  const smoothedSpeedDiffRef = React.useRef(targetSpeedDiff);

  React.useEffect(() => {
    if (limitNum === null || !Number.isFinite(targetSpeedDiff)) {
      smoothedSpeedDiffRef.current = 0;
      setSmoothedSpeedDiff(0);
      return;
    }

    if (Math.abs(smoothedSpeedDiffRef.current - targetSpeedDiff) <= 0.05) {
      smoothedSpeedDiffRef.current = targetSpeedDiff;
      setSmoothedSpeedDiff(targetSpeedDiff);
      return;
    }

    let frameId: number | null = null;
    const animate = () => {
      const prev = smoothedSpeedDiffRef.current;
      const next = prev + (targetSpeedDiff - prev) * 0.12;

      if (Math.abs(next - prev) > 1e-6) {
        smoothedSpeedDiffRef.current = next;
        setSmoothedSpeedDiff(next);
      }

      if (Math.abs(targetSpeedDiff - next) > 0.05) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [targetSpeedDiff, limitNum]);

  const isWarning =
    limitNum !== null &&
    (currentSpeedKmH < limitNum - 10 || currentSpeedKmH > limitNum + 5);

  const fetchInterval = isWarning ? 5000 : 10000;

  const navDataRef = React.useRef(navigationData);
  const stepIdxRef = React.useRef(currentStepIndex);
  const isFetchingRef = React.useRef(false);

  React.useEffect(() => {
    navDataRef.current = navigationData;
  }, [navigationData]);

  React.useEffect(() => {
    stepIdxRef.current = currentStepIndex;
  }, [currentStepIndex]);

  const fetchSpeedLimit = React.useCallback(async () => {
    if (!isCarMode) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const currentPos = positionRef.current;
      const currentNavData = navDataRef.current;
      const currentStepIdx = stepIdxRef.current;

      if (
        !currentPos ||
        !Number.isFinite(currentPos.latitude) ||
        !Number.isFinite(currentPos.longitude)
      ) {
        return;
      }

      const points: Coordinate[] = [
        { latitude: currentPos.latitude, longitude: currentPos.longitude },
      ];

      if (currentNavData?.steps?.[currentStepIdx]?.coordinates) {
        const stepCoords = currentNavData.steps[currentStepIdx].coordinates;
        if (stepCoords.length > 1) {
          const nextCoord = stepCoords[1];
          points.push({ latitude: nextCoord[1], longitude: nextCoord[0] });
        } else {
          const nextStep = currentNavData.steps[currentStepIdx + 1];
          if (nextStep?.coordinates?.[0]) {
            points.push({
              latitude: nextStep.coordinates[0][1],
              longitude: nextStep.coordinates[0][0],
            });
          }
        }
      }

      if (points.length < 2) {
        points.push({
          latitude: currentPos.latitude + 0.0005,
          longitude: currentPos.longitude + 0.0005,
        });
      }

      const limit = await routeService.getSpeedLimit(points);
      if (limit) {
        setSpeedLimit(limit);
      }
    } catch {
    } finally {
      isFetchingRef.current = false;
    }
  }, [routeService, isCarMode]);

  React.useEffect(() => {
    if (!isCarMode) {
      setSpeedLimit(null);
    }
  }, [isCarMode]);

  React.useEffect(() => {
    if (!isCarMode) return;
    const timer = setInterval(fetchSpeedLimit, fetchInterval);
    return () => clearInterval(timer);
  }, [fetchSpeedLimit, fetchInterval, isCarMode]);

  React.useEffect(() => {
    if (!isCarMode) return;
    fetchSpeedLimit();
  }, [currentStepIndex, fetchSpeedLimit, isCarMode]);

  const mapPins = React.useMemo<WaypointPin[]>(() => {
    const pins: WaypointPin[] = [];
    if (startCoordinate) {
      pins.push({
        lat: startCoordinate.latitude,
        lng: startCoordinate.longitude,
        type: "departure",
      });
    }
    if (destLat !== null && destLng !== null) {
      pins.push({ lat: destLat, lng: destLng, type: "destination" });
    }
    return pins;
  }, [startCoordinate?.latitude, startCoordinate?.longitude, destLat, destLng]);

  const getStepIconName = (stepOrInstruction?: any) => {
    const instr =
      typeof stepOrInstruction === "string"
        ? stepOrInstruction
        : stepOrInstruction?.instruction;
    const m = stepOrInstruction?.maneuver || undefined;

    const mod = (m?.modifier || "").toLowerCase();
    const type = (m?.type || "").toLowerCase();

    if (type.includes("depart")) return "play-arrow";
    if (type.includes("arriv") || type.includes("arrive")) return "flag";

    if (type.includes("round") || type.includes("rotary")) return "directions";

    if (
      type.includes("exit") ||
      type.includes("exit roundabout") ||
      type.includes("exit rotary")
    ) {
      if (mod.includes("left")) return "turn-slight-left";
      if (mod.includes("right")) return "turn-slight-right";
      if (mod.includes("slight left")) return "turn-slight-left";
      if (mod.includes("slight right")) return "turn-slight-right";
      if (mod.includes("straight")) return "arrow-forward";
      return "directions";
    }

    if (type.includes("turn") || type === "turn") {
      if (mod.includes("left")) return "turn-slight-left";
      if (mod.includes("right")) return "turn-slight-right";
      if (mod.includes("slight left")) return "turn-slight-left";
      if (mod.includes("slight right")) return "turn-slight-right";
      if (mod.includes("straight")) return "arrow-forward";
      return "directions";
    }

    if (type.includes("new name")) return "directions";
    if (type.includes("end") || type.includes("end of road")) return "block";

    const s = (instr || "").toLowerCase();
    if (!s) return "directions";
    if (s.includes("arriv")) return "flag";
    if (s.includes("gauche") || s.includes("left")) return "turn-slight-left";
    if (s.includes("droite") || s.includes("right")) return "turn-slight-right";
    if (s.includes("slight") && s.includes("left")) return "turn-slight-left";
    if (s.includes("slight") && s.includes("right")) return "turn-slight-right";
    if (
      s.includes("tout droit") ||
      s.includes("straight") ||
      s.includes("continue")
    )
      return "arrow-forward";
    if (s.includes("rond") || s.includes("roundabout")) return "directions";
    return "directions";
  };

  const formatStepInstructionRaw = (step?: any): string => {
    if (!step) return "";
    const m = step.maneuver;
    const road = step.ref || step.name || undefined;

    if (!m?.type) {
      return step.instruction || "";
    }

    const type = m.type.toLowerCase();
    const mod = (m.modifier || "").toLowerCase();

    if (type === "depart") {
      return road ? t("maneuver.departRoad", { road }) : t("maneuver.depart");
    }

    if (type === "arrive") {
      return road ? t("maneuver.arriveRoad", { road }) : t("maneuver.arrive");
    }

    if (
      type === "roundabout" ||
      type === "rotary" ||
      type.includes("round") ||
      type.includes("rotary")
    ) {
      if (typeof m.exit === "number") {
        return road
          ? t("maneuver.roundaboutExitRoad", { exit: m.exit, road })
          : t("maneuver.roundaboutExit", { exit: m.exit });
      }
      return road
        ? t("maneuver.roundaboutContinueRoad", { road })
        : t("maneuver.roundaboutContinue");
    }

    if (type === "turn" || type === "end of road" || type === "fork") {
      if (mod.includes("slight left") || mod === "slight left")
        return road
          ? t("maneuver.slightLeftRoad", { road })
          : t("maneuver.slightLeft");
      if (mod.includes("slight right") || mod === "slight right")
        return road
          ? t("maneuver.slightRightRoad", { road })
          : t("maneuver.slightRight");
      if (mod.includes("sharp left"))
        return road
          ? t("maneuver.sharpLeftRoad", { road })
          : t("maneuver.sharpLeft");
      if (mod.includes("sharp right"))
        return road
          ? t("maneuver.sharpRightRoad", { road })
          : t("maneuver.sharpRight");
      if (mod.includes("left"))
        return road
          ? t("maneuver.turnLeftRoad", { road })
          : t("maneuver.turnLeft");
      if (mod.includes("right"))
        return road
          ? t("maneuver.turnRightRoad", { road })
          : t("maneuver.turnRight");
      if (mod.includes("straight") || mod.includes("uturn"))
        return road
          ? t("maneuver.continueStraightRoad", { road })
          : t("maneuver.continueStraight");
      return road
        ? t("maneuver.turnGenericRoad", { road })
        : t("maneuver.turnGeneric");
    }

    if (type === "new name" || type === "continue") {
      return road
        ? t("maneuver.continueRoad", { road })
        : t("maneuver.continueStraight");
    }

    if (type === "merge") {
      return road ? t("maneuver.mergeRoad", { road }) : t("maneuver.merge");
    }

    if (type === "on ramp" || type === "off ramp") {
      if (mod.includes("left"))
        return road
          ? t("maneuver.rampLeftRoad", { road })
          : t("maneuver.rampLeft");
      if (mod.includes("right"))
        return road
          ? t("maneuver.rampRightRoad", { road })
          : t("maneuver.rampRight");
      return road ? t("maneuver.rampRoad", { road }) : t("maneuver.ramp");
    }

    return step.instruction || "";
  };

  const formatStepInstruction = (step?: any): string => {
    const text = formatStepInstructionRaw(step);
    if (!text) return "";
    if (settings?.marineMode) {
      return text
        .replaceAll(/\bgauche\b/gi, "bâbord")
        .replaceAll(/\bleft\b/gi, "port")
        .replaceAll(/\bdroite\b/gi, "tribord")
        .replaceAll(/\bright\b/gi, "starboard");
    }
    return text;
  };

  React.useEffect(() => {
    if (!mapReady) return;

    if (routeService.routeCoords.length >= 2) {
      post({
        type: "setPolyline",
        latlngs: routeService.routeCoords.map((c) => [c.latitude, c.longitude]),
        color: "#0d7ff2",
        weight: 3,
        opacity: 1.0,
      });
    }

    post({ type: "clearMarkers" });
    const valid = mapPins.filter((p) => p.lat && p.lng);
    valid.forEach((p) => {
      post({
        type: "addMarker",
        lat: p.lat,
        lng: p.lng,
        html: "<div></div>",
        iconSize: [1, 1],
      });
    });
  }, [mapReady, routeService.routeCoords, mapPins]);

  React.useEffect(() => {
    if (
      !mapReady ||
      !position ||
      !Number.isFinite(position.latitude) ||
      !Number.isFinite(position.longitude) ||
      isDeadReckoningRef.current
    )
      return;

    post({
      type: "setUserMarker",
      lat: position.latitude,
      lng: position.longitude,
      heading: position?.heading || undefined,
      icon: "circle",
      animate: false,
    });
  }, [mapReady, position?.latitude, position?.longitude]);

  React.useEffect(() => {
    if (!mapReady || !navigationData) return;
    post({ type: "clearOverlayPolylines" });

    const navSteps = navigationData.steps || [];
    navSteps.forEach((s) => {
      const coords = s.coordinates;
      const mType = (s.maneuver?.type || "").toLowerCase();
      if (
        !coords ||
        coords.length < 2 ||
        mType === "depart" ||
        mType === "arrive"
      )
        return;

      const segmentCoords = coords.slice(0, 4).map(([lng, lat]) => [lat, lng]);
      post({
        type: "addOverlayPolyline",
        latlngs: segmentCoords,
        color: "#fff",
        weight: 3,
        opacity: 1,
        arrow: true,
      });
    });
  }, [mapReady, navigationData?.steps]);

  React.useEffect(() => {
    if (
      mapReady &&
      following &&
      !isDeadReckoningRef.current &&
      position &&
      Number.isFinite(position.latitude) &&
      Number.isFinite(position.longitude)
    ) {
      (async () => {
        const previousZoom = lastCameraZoomRef.current;
        const shouldAnimateZoom =
          previousZoom !== null && Math.abs(previousZoom - targetZoom) > 0.001;
        lastCameraZoomRef.current = targetZoom;

        const gpsHeading = Number((position as any)?.heading);
        const speedMps = Number((position as any)?.speed ?? 0);
        let bearing = lastKnownBearingRef.current;

        if (Number.isFinite(gpsHeading) && speedMps >= 0.8) {
          bearing = ((gpsHeading % 360) + 360) % 360;
        } else {
          const prev = prevPositionForBearingRef.current;
          if (prev) {
            const movedMeters = calculateDistance(prev, {
              latitude: position.latitude,
              longitude: position.longitude,
            });
            if (movedMeters >= 2) {
              bearing = calculateBearing(prev, {
                latitude: position.latitude,
                longitude: position.longitude,
              });
            }
          }
        }

        prevPositionForBearingRef.current = {
          latitude: position.latitude,
          longitude: position.longitude,
        };
        lastKnownBearingRef.current = bearing;

        const cameraOffsetY = 140;

        const currentSpeedKmhEffect = (position.speed ?? 0) * 3.6;

        let targetPitch = currentPitchRef.current;
        if (currentSpeedKmhEffect > 15) {
          targetPitch = 45;
        } else if (currentSpeedKmhEffect < 5) {
          targetPitch = 0;
        }
        currentPitchRef.current = targetPitch;
        post({
          type: "panTo",
          lat: position.latitude,
          lng: position.longitude,
          zoom: targetZoom,
          bearing,
          pitch: targetPitch,
          offsetY: cameraOffsetY,
          animate: shouldAnimateZoom,
          duration: shouldAnimateZoom ? 0.45 : 0,
        });
      })();
    }
  }, [position, following, mapReady, targetZoom, limitNum]);

  const stepDistanceLabel = approachingStep
    ? `${formatDistance(distanceToNextManeuver)}${timeToNextManeuver >= 1 ? " • " + formatDuration(timeToNextManeuver) : ""}`
    : routeService.isCalculating
      ? "…"
      : "—";
  const stepInstruction = approachingStep
    ? formatStepInstruction(approachingStep)
    : routeService.isCalculating
      ? t("calculating")
      : t("waitingForRoute");

  const lastInstructionId = React.useRef("");
  const hasAnnouncedAction = React.useRef(false);

  React.useEffect(() => {
    if (
      !stepInstruction ||
      stepInstruction === t("waitingForRoute") ||
      stepInstruction === t("calculating")
    )
      return;

    const instructionId = `${stepInstruction}`;

    const speak = (text: string) => {
      Speech.stop();
      Speech.speak(text, {
        language: Localization.getLocales()[0].languageTag,
      });
    };

    if (guideMode === "all") {
      if (lastInstructionId.current !== instructionId) {
        let dist = Math.round(distanceToNextManeuver);
        let unit = t("units.meters");
        if (dist > 50 && dist <= 200) {
          dist = Math.round(dist / 10) * 10;
        } else if (dist > 200) {
          dist = Math.round(dist / 100) * 100;
        }

        if (dist >= 1000) {
          dist = Math.round(dist / 1000);
          unit = t("units.kilometers");
        }

        speak(`${t("in")} ${dist} ${unit}, ${stepInstruction}`);
        lastInstructionId.current = instructionId;
        hasAnnouncedAction.current = false;
      }
    }

    if (distanceToNextManeuver <= 100 && !hasAnnouncedAction.current) {
      speak(stepInstruction);
      hasAnnouncedAction.current = true;

      if (guideMode === "alert") {
        lastInstructionId.current = instructionId;
      }
    }

    if (lastInstructionId.current !== instructionId) {
      lastInstructionId.current = instructionId;
      hasAnnouncedAction.current = false;
    }
  }, [stepInstruction, distanceToNextManeuver, guideMode]);

  const warningColor = React.useMemo(() => {
    if (!isCarMode) return "#074fa8";
    if (limitNum === null) return "#074fa8";
    return interpolateColor(smoothedSpeedDiff);
  }, [smoothedSpeedDiff, limitNum, isCarMode]);

  return (
    <View className="flex-1 bg-black">
      <StatusBar
        hidden
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <View className="flex-1 rounded-2xl overflow-hidden relative">
        {routeService.isCalculating && routeService.routeCoords.length === 0 ? (
          <View className="absolute inset-0 bg-black/60 items-center justify-center z-50">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        ) : null}
        <ShadcnMap ref={mapRef} initialZoom={2} onMapMessage={handleMapMsg} />
        <View className="absolute inset-0 items-center pointer-events-none">
          <Svg height={320} className="pointer-events-none" width="100%">
            <Defs>
              <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="0.6">
                <Stop offset="0" stopColor={warningColor} stopOpacity="0.96" />
                <Stop offset="1" stopColor={warningColor} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
          </Svg>
          <View
            className="absolute top-0 left-0 right-0 w-full"
            pointerEvents="box-none"
            style={{
              paddingTop: Math.max(insets.top, Constants.statusBarHeight) + 16,
            }}
          >
            <View className="mx-4 rounded-xl bg-[#12202a]/80 p-4 flex-row items-center">
              <View className="w-12 h-12 mr-4 items-center justify-center">
                {approachingStep &&
                (approachingStep.maneuver?.type === "roundabout" ||
                  approachingStep.maneuver?.type === "rotary" ||
                  String(approachingStep.maneuver?.type)
                    .toLowerCase()
                    .includes("round") ||
                  String(approachingStep.maneuver?.type)
                    .toLowerCase()
                    .includes("rotary")) ? (
                  <View className="w-12 h-12 rounded-full bg-[#0d7ff2] items-center justify-center">
                    <Text className="text-white font-bold">
                      {typeof approachingStep.maneuver?.exit === "number"
                        ? String(approachingStep.maneuver.exit)
                        : ""}
                    </Text>
                  </View>
                ) : (
                  <MaterialIcons
                    name={getStepIconName(approachingStep) as any}
                    size={32}
                    color="#fff"
                  />
                )}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-white text-lg font-medium">
                    {stepInstruction}
                  </Text>
                </View>
                <Text className="text-gray-400" numberOfLines={2}>
                  {stepDistanceLabel}
                </Text>
                {approachingStep?.intersections?.[0]?.lanes &&
                  approachingStep.intersections[0].lanes.length > 0 && (
                    <View className="flex-row items-center mt-1.5 gap-1 bg-black/40 self-start px-2 py-1 rounded-lg border border-white/10">
                      {approachingStep.intersections[0].lanes.map(
                        (lane: any, idx: number) => (
                          <LaneArrow
                            key={idx}
                            indications={lane.indications || []}
                            valid={lane.valid}
                            color="#ffffff"
                            invalidColor="#555555"
                          />
                        ),
                      )}
                    </View>
                  )}
              </View>
            </View>
          </View>
          {isSimulated && (
            <View className="absolute top-[20px] bg-[#e01e1e] px-4 py-2 rounded-full z-50 shadow-md">
              <Text className="text-white font-bold text-sm">
                Signal GPS perdu - Estimation
              </Text>
            </View>
          )}
        </View>
      </View>

      {isCarMode && speedLimit && (
        <Animated.View
          className="absolute right-4 z-[100]"
          style={{ bottom: speedPanelBottom }}
        >
          <View className="w-[60px] h-[60px] rounded-full bg-white border-[6px] border-[#e01e1e] items-center justify-center shadow-md shadow-black/30 elevation-4">
            <Text className="text-black text-[24px] font-bold">
              {speedLimit}
            </Text>
          </View>
        </Animated.View>
      )}

      {activeTrafficAlert && (
        <Animated.View
          className="absolute left-4 z-[95]"
          style={{
            right: 16,
            top: insets.top + 150,
          }}
          pointerEvents="box-none"
        >
          <Animated.View
            style={{
              opacity: alertAnim,
              transform: [
                {
                  translateY: alertAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            }}
          >
            <View
              style={{
                backgroundColor:
                  activeTrafficAlert.Severity === "high"
                    ? "#1a0a0a"
                    : activeTrafficAlert.Severity === "low"
                      ? "#0a0f1a"
                      : "#1a110a",
                borderRadius: 16,
                borderWidth: 1,
                borderColor:
                  activeTrafficAlert.Severity === "high"
                    ? "#ef4444"
                    : activeTrafficAlert.Severity === "low"
                      ? "#3b82f6"
                      : "#f59e0b",
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                shadowColor: "#000",
                shadowOpacity: 0.4,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 6,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor:
                    activeTrafficAlert.Severity === "high"
                      ? "#ef444420"
                      : activeTrafficAlert.Severity === "low"
                        ? "#3b82f620"
                        : "#f59e0b20",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                  flexShrink: 0,
                }}
              >
                <MaterialIcons
                  name={
                    activeTrafficAlert.Type === "Accident"
                      ? "car-crash"
                      : activeTrafficAlert.Type === "ConstructionWorks" ||
                          activeTrafficAlert.Type === "MaintenanceWorks"
                        ? "construction"
                        : activeTrafficAlert.Type === "AbnormalTraffic"
                          ? "traffic"
                          : activeTrafficAlert.Type === "VehicleObstruction"
                            ? "directions-car"
                            : activeTrafficAlert.Type === "AuthorityOperation"
                              ? "local-police"
                              : "warning"
                  }
                  size={18}
                  color={
                    activeTrafficAlert.Severity === "high"
                      ? "#ef4444"
                      : activeTrafficAlert.Severity === "low"
                        ? "#3b82f6"
                        : "#f59e0b"
                  }
                />
              </View>

              <View style={{ flex: 1, marginRight: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 2,
                  }}
                >
                  {activeTrafficAlert.isReminder && (
                    <View
                      style={{
                        backgroundColor: "#f59e0b20",
                        borderRadius: 4,
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                        marginRight: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: "#f59e0b",
                          fontSize: 9,
                          fontWeight: "700",
                        }}
                      >
                        {tTraffic("reminder")}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: "700",
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {tTraffic(`eventTypes.${activeTrafficAlert.Type}`, {
                      defaultValue: tTraffic("trafficAlert"),
                    })}
                  </Text>
                </View>
                <Text
                  style={{ color: "#94a3b8", fontSize: 11, fontWeight: "600" }}
                  numberOfLines={1}
                >
                  {activeTrafficAlert.RoadName
                    ? `${activeTrafficAlert.RoadName} · `
                    : ""}
                  {activeTrafficAlert.Description ||
                    tTraffic("disturbanceReported")}
                </Text>
              </View>

              <TouchableOpacity
                onPress={dismissActiveAlert}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {activeHazardAlert && (
        <Animated.View
          className="absolute left-4 z-[95]"
          style={{
            right: 16,
            top: insets.top + 150,
          }}
          pointerEvents="box-none"
        >
          <Animated.View
            style={{
              opacity: hazardAlertAnim,
              transform: [
                {
                  translateY: hazardAlertAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            }}
          >
            <View
              style={{
                backgroundColor:
                  activeHazardAlert.type === "speed_camera" ||
                  activeHazardAlert.type === "level_crossing"
                    ? "#1a0a0a"
                    : activeHazardAlert.type === "dangerous_curve"
                      ? "#1a110a"
                      : "#0a0f1a",
                borderRadius: 16,
                borderWidth: 1,
                borderColor:
                  activeHazardAlert.type === "speed_camera" ||
                  activeHazardAlert.type === "level_crossing"
                    ? "#ef444440"
                    : activeHazardAlert.type === "dangerous_curve"
                      ? "#f9731640"
                      : "#3b82f640",
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                shadowColor:
                  activeHazardAlert.type === "speed_camera" ||
                  activeHazardAlert.type === "level_crossing"
                    ? "#ef4444"
                    : activeHazardAlert.type === "dangerous_curve"
                      ? "#f97316"
                      : "#3b82f6",
                shadowOpacity: 0.4,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 6,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor:
                    activeHazardAlert.type === "speed_camera" ||
                    activeHazardAlert.type === "level_crossing"
                      ? "#ef444420"
                      : activeHazardAlert.type === "dangerous_curve"
                        ? "#f9731620"
                        : "#3b82f620",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                  flexShrink: 0,
                }}
              >
                <MaterialIcons
                  name={
                    activeHazardAlert.type === "speed_camera"
                      ? "camera-alt"
                      : activeHazardAlert.type === "level_crossing"
                        ? "train"
                        : activeHazardAlert.type === "speed_bump"
                          ? "speed"
                          : activeHazardAlert.type === "school_zone"
                            ? "school"
                            : "warning"
                  }
                  size={18}
                  color={
                    activeHazardAlert.type === "speed_camera" ||
                    activeHazardAlert.type === "level_crossing"
                      ? "#ef4444"
                      : activeHazardAlert.type === "dangerous_curve"
                        ? "#f97316"
                        : activeHazardAlert.type === "speed_bump"
                          ? "#facc15"
                          : "#3b82f6"
                  }
                />
              </View>

              <View style={{ flex: 1, marginRight: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 2,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                    numberOfLines={1}
                  >
                    {activeHazardAlert.type === "speed_bump"
                      ? "Ralentisseur"
                      : activeHazardAlert.type === "speed_camera"
                        ? "Radar"
                        : activeHazardAlert.type === "level_crossing"
                          ? "Passage à niveau"
                          : activeHazardAlert.type === "school_zone"
                            ? "Zone scolaire"
                            : activeHazardAlert.type === "dangerous_curve"
                              ? "Virage dangereux"
                              : activeHazardAlert.type ===
                                    "priority_to_right" ||
                                  activeHazardAlert.type ===
                                    "blind_intersection"
                                ? "Priorité à droite"
                                : "Danger"}
                  </Text>
                </View>
                <Text
                  style={{ color: "#9ca3af", fontSize: 13 }}
                  numberOfLines={1}
                >
                  dans {activeHazardAlert.distance || 0} m
                </Text>
              </View>

              <TouchableOpacity
                onPress={dismissHazardAlert}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="close" size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        index={0}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        enableContentPanningGesture={true}
        enableHandlePanningGesture={true}
        onAnimate={(_, toIndex) => {
          const idx = Math.max(0, toIndex);
          setMainSheetIndex(idx);
          animateSpeedPanelToIndex(idx);
        }}
        onChange={(index) => {
          const idx = Math.max(0, index);
          setMainSheetIndex(idx);
          speedPanelBottom.setValue(
            (mainSheetHeights[idx] ?? mainSheetHeights[0]) + 20,
          );
        }}
        backgroundStyle={{ backgroundColor: "#12202a" }}
        style={{ borderRadius: 30, overflow: "hidden" }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.3)" }}
      >
        <BottomSheetView className="flex-1 z-20 px-5 pt-6 pb-[env(safe-area-inset-bottom)+16px]">
          <View className="flex-row justify-between items-end mb-4">
            <View>
              <Text className="text-white text-[30px] font-bold">
                {routeService.isCalculating
                  ? "…"
                  : formatDuration(totalDuration)}
              </Text>
              <Text
                className="text-[#90adcb] text-[13px] mt-0.5"
                numberOfLines={1}
              >
                {formatDistance(totalDistance)}
                {etaLabel ? ` • ${t("eta", { time: etaLabel })}` : ""}
              </Text>
            </View>
            <TouchableOpacity
              className="flex-row items-center justify-center gap-2 rounded-xl py-2.5 px-4 bg-[#0d7ff2]/10 border border-[#0d7ff2]/20"
              onPress={() => {
                showCommingSoonToast();
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="search"
                size={18}
                color={Colors.dark.primary}
              />
              <Text className="text-[#0d7ff2] font-bold text-[14px]">
                {t("addStop")}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-3 mt-1.5">
            {!following ? (
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl py-3.5 bg-[#0d7ff2]"
                onPress={() => setFollowing(true)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="my-location" size={18} color="#fff" />
                <Text className="text-white font-bold text-[14px]">
                  {t("recenter")}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl py-3.5 border border-white/20 bg-white/5"
                  onPress={handleRoutes}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="alt-route" size={18} color="#fff" />
                  <Text className="text-white font-bold text-[14px]">
                    {t("route")}
                  </Text>
                  {activeTrafficAlerts && activeTrafficAlerts.length > 0 && (
                    <MaterialIcons name="warning" size={14} color="#f59e0b" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-[1.5] flex-row items-center justify-center gap-1.5 rounded-2xl py-3.5 bg-[#0d7ff2]"
                  onPress={handleStopTrip}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="stop" size={18} color="#fff" />
                  <Text className="text-white font-bold text-[14px]">
                    {t("stopTrip")}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View className="h-[1px] bg-white/5 my-3 rounded-sm" />

          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white text-[15px] font-bold">
                {t("mapStyle")}
              </Text>
              <MaterialIcons name="layers" size={20} color="#8a8a8a" />
            </View>

            <View className="flex-row justify-between bg-[#12202a] p-1.5 rounded-xl border border-white/5">
              <TouchableOpacity
                className={cn(
                  "flex-1 mx-1 py-2.5 rounded-lg items-center bg-transparent",
                  baseLayer === "standard" && "bg-white/5",
                )}
                onPress={() => layers.setMapType("standard")}
              >
                <Text
                  className={cn(
                    "text-[#9aa4b2] font-bold text-[13px]",
                    baseLayer === "standard" && "text-white",
                  )}
                >
                  {t("layerStandard")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={cn(
                  "flex-1 mx-1 py-2.5 rounded-lg items-center bg-transparent",
                  baseLayer === "satellite" && "bg-white/5",
                )}
                onPress={() => layers.setMapType("satellite")}
              >
                <Text
                  className={cn(
                    "text-[#9aa4b2] font-bold text-[13px]",
                    baseLayer === "satellite" && "text-white",
                  )}
                >
                  {t("layerSatellite")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={cn(
                  "flex-1 mx-1 py-2.5 rounded-lg items-center bg-transparent",
                  baseLayer === "terrain" && "bg-white/5",
                )}
                onPress={() => layers.setMapType("terrain")}
              >
                <Text
                  className={cn(
                    "text-[#9aa4b2] font-bold text-[13px]",
                    baseLayer === "terrain" && "text-white",
                  )}
                >
                  {t("layerTerrain")}
                </Text>
              </TouchableOpacity>
            </View>

            {baseLayer !== "satellite" && (
              <View className="flex-row items-center justify-between mt-2.5">
                <Text className="text-[#c1c8cf] text-[13px] font-semibold">
                  {t("darkMode")}
                </Text>
                <Switch
                  value={themeMode === "dark"}
                  onValueChange={() => layers.setDarkTheme(!layers.darkTheme)}
                  trackColor={{ false: "#444", true: Colors.dark.primary }}
                  thumbColor="#fff"
                />
              </View>
            )}

            <View className="mt-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-white text-[15px] font-bold">
                  {t("guideVolume")}
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    await Speech.speak(t("guideVolumeSample"), {
                      language: Localization.getLocales()[0].languageTag,
                    });
                  }}
                >
                  <MaterialIcons name="volume-up" size={20} color="#8a8a8a" />
                </TouchableOpacity>
              </View>

              <View className="flex-row justify-between bg-[#12202a] p-1.5 rounded-xl border border-white/5">
                <TouchableOpacity
                  className={cn(
                    "flex-1 mx-1 py-2.5 rounded-lg items-center bg-transparent",
                    guideMode === "off" && "bg-white/5",
                  )}
                  onPress={() => setGuideMode("off")}
                >
                  <Text
                    className={cn(
                      "text-[#9aa4b2] font-bold text-[13px]",
                      guideMode === "off" && "text-white",
                    )}
                  >
                    {t("volumeMute")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={cn(
                    "flex-1 mx-1 py-2.5 rounded-lg items-center bg-transparent",
                    guideMode === "alert" && "bg-white/5",
                  )}
                  onPress={() => {
                    setGuideMode("alert");
                  }}
                >
                  <Text
                    className={cn(
                      "text-[#9aa4b2] font-bold text-[13px]",
                      guideMode === "alert" && "text-white",
                    )}
                  >
                    {t("volumeAlerts")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={cn(
                    "flex-1 mx-1 py-2.5 rounded-lg items-center bg-transparent",
                    guideMode === "all" && "bg-[#0d7ff2]",
                  )}
                  onPress={() => {
                    setGuideMode("all");
                  }}
                >
                  <Text
                    className={cn(
                      "text-[#9aa4b2] font-bold text-[13px]",
                      guideMode === "all" && "text-white",
                    )}
                  >
                    {t("volumeFull")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {showStepsSheet && (
        <BottomSheet
          ref={stepsSheetRef}
          snapPoints={stepsSnapPoints}
          index={1}
          enablePanDownToClose={true}
          enableHandlePanningGesture={true}
          enableContentPanningGesture={true}
          enableOverDrag={false}
          containerStyle={{ zIndex: 300 }}
          backgroundStyle={{ backgroundColor: "#12202a" }}
          handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.3)" }}
          onChange={(idx) => {
            if (typeof idx === "number" && idx < 0) setShowStepsSheet(false);
          }}
        >
          <View className="px-5">
            <View className="flex-row items-center justify-between py-4">
              <View>
                <Text className="text-white">{t("steps")}</Text>
                <Text className="text-gray-400">
                  {t("stepsCount", {
                    count: routeService.getNavigationData()?.steps?.length ?? 0,
                  })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowStepsSheet(false)}>
                <MaterialIcons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <BottomSheetFlatList
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 12,
              paddingHorizontal: 20,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            data={combinedStepsData}
            keyExtractor={(item: any, index: number) => index.toString()}
            renderItem={({ item, index: i }: { item: any; index: number }) => {
              if (item.type === "alert") {
                const alert = item.data as TrafficAlertData;
                const bgColor =
                  alert.Severity === "high"
                    ? "#1a0a0a"
                    : alert.Severity === "low"
                      ? "#0a0f1a"
                      : "#1a110a";
                const borderColor =
                  alert.Severity === "high"
                    ? "#ef4444"
                    : alert.Severity === "low"
                      ? "#3b82f6"
                      : "#f59e0b";
                const iconBgColor =
                  alert.Severity === "high"
                    ? "#ef444420"
                    : alert.Severity === "low"
                      ? "#3b82f620"
                      : "#f59e0b20";
                const iconColor = borderColor;

                let iconName = "warning";
                if (alert.Type === "Accident") {
                  iconName = "car-crash";
                } else if (
                  alert.Type === "ConstructionWorks" ||
                  alert.Type === "MaintenanceWorks"
                ) {
                  iconName = "construction";
                } else if (alert.Type === "AbnormalTraffic") {
                  iconName = "traffic";
                } else if (alert.Type === "VehicleObstruction") {
                  iconName = "directions-car";
                } else if (alert.Type === "AuthorityOperation") {
                  iconName = "local-police";
                }

                const title = tTraffic(`eventTypes.${alert.Type}`, {
                  defaultValue: tTraffic("trafficAlert"),
                });

                return (
                  <View
                    style={{
                      backgroundColor: bgColor,
                      borderColor: borderColor,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 10,
                      marginVertical: 6,
                      marginLeft: 24,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: iconBgColor,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 8,
                      }}
                    >
                      <MaterialIcons
                        name={iconName as any}
                        size={14}
                        color={iconColor}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: "700",
                        }}
                      >
                        {title}
                      </Text>
                      <Text
                        style={{ color: "#94a3b8", fontSize: 11 }}
                        numberOfLines={1}
                      >
                        {alert.RoadName ? `${alert.RoadName} · ` : ""}
                        {alert.Description || tTraffic("disturbanceReported")}
                      </Text>
                    </View>
                  </View>
                );
              }

              const s = item.data;
              const maneuverType = String(
                s?.maneuver?.type || "",
              ).toLowerCase();
              const isRound =
                maneuverType === "roundabout" ||
                maneuverType === "rotary" ||
                maneuverType.includes("round") ||
                maneuverType.includes("rotary");

              return (
                <View className="flex-row items-center py-3">
                  <View className="mr-3">
                    {isRound ? (
                      <View className="w-8 h-8 rounded-full bg-[#0d7ff2] items-center justify-center">
                        <Text className="text-white">
                          {typeof s.maneuver?.exit === "number"
                            ? String(s.maneuver.exit)
                            : ""}
                        </Text>
                      </View>
                    ) : (
                      <MaterialIcons
                        name={getStepIconName(s) as any}
                        size={18}
                        color="#fff"
                      />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-white" numberOfLines={2}>
                      {formatStepInstruction(s) || s.instruction || "-"}
                    </Text>
                    <Text className="text-gray-400">
                      {formatDistance(s.distance)} •{" "}
                      {formatDuration(s.duration)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        </BottomSheet>
      )}
    </View>
  );
}
