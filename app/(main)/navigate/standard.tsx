import { WaypointPin } from "@/components/MapSnapshot";
import ShadcnMap from "@/components/ShadcnMap";
import { useMapLayers } from "@/components/map/MapLayersContext";
import { Colors } from "@/constants/theme";
import { usePosition } from "@/contexts/PositionContext";
import { useUser } from "@/contexts/UserContext";
import { createTranslator } from "@/i18n";
import type { Coordinate } from "@/services/RouteService";
import { useRouteService } from "@/services/RouteService";
import { cn } from "@/utils/cn";
import { showCommingSoonToast } from "@/utils/commingSoonToast";
import { addRecentTrip } from "@/utils/recentTrips";
import { snapPointsPercent } from "@/utils/snapPoints";
import { MaterialIcons } from "@expo/vector-icons";
import BottomSheet, {
    BottomSheetFlatList,
    BottomSheetView,
} from "@gorhom/bottom-sheet";
import * as Localization from "expo-localization";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import React from "react";
import {
    Animated,
    Easing,
    StatusBar,
    Switch,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

type NavigationMode = "car" | "walk" | "bike";

const OFF_ROUTE_RECALC_DISTANCE_M = 10;
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
  const { settings } = useUser();
  const layers = useMapLayers();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lat, lng, mode, name, multi } = useLocalSearchParams();
  const { position } = usePosition();
  const positionRef = React.useRef(position);
  React.useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const routeService = useRouteService();
  const mapRef = React.useRef<any>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const [following, setFollowing] = React.useState(true);
  const suppressMapMove = React.useRef(false);
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
              suppressMapMove.current = true;
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
        if (suppressMapMove.current) {
          suppressMapMove.current = false;
        } else {
          setFollowing(false);
        }
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
                const res = await routeService.recalculateIfOffRoute(
                  currentPos,
                  serviceMode,
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
                    post({ type: "clearPolyline" });
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
                  const res = await routeService.recalculateIfOffRoute(
                    currentPos,
                    serviceMode,
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
                      post({ type: "clearPolyline" });
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

  const handleStopTrip = () => {
    routeService.clearRoute();
    router.back();
  };

  const handleRoutes = async () => {
    setShowStepsSheet(true);
  };

  const navigationData = routeService.getNavigationData();

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

  const totalDuration = navigationData?.totalDuration ?? 0;
  const totalDistance = navigationData?.totalDistance ?? 0;
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
    if (requestedMode !== "car") return;
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

    const distanceToDestination = calculateDistance(
      { latitude: position.latitude, longitude: position.longitude },
      { latitude: destLat, longitude: destLng },
    );

    if (distanceToDestination > 200) return;

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
  ]);

  const targetZoom = React.useMemo(() => {
    const baseZoom = 17;
    let maxLayerZoom = 19;
    if (baseLayer === "terrain") maxLayerZoom = 17;

    if (approachingStep && distanceToNextManeuver < 200) {
      return Math.min(baseZoom + 1, maxLayerZoom);
    }
    return Math.min(baseZoom, maxLayerZoom);
  }, [distanceToNextManeuver, approachingStep, baseLayer]);
  const lastCameraZoomRef = React.useRef<number | null>(null);

  const currentSpeedKmH = (position?.speed ?? 0) * 3.6;
  const limitNum = isCarMode && speedLimit ? parseInt(speedLimit, 10) : null;
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

  const formatStepInstruction = (step?: any): string => {
    if (!step) return "";
    const m = step.maneuver;
    const road = step.name && step.name !== "" ? step.name : null;

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

  React.useEffect(() => {
    if (!mapReady) return;
    post({ type: "clearPolyline" });
    if (routeService.routeCoords.length >= 2) {
      post({
        type: "setPolyline",
        latlngs: routeService.routeCoords.map((c) => [c.latitude, c.longitude]),
        color: "#0d7ff2",
        weight: 3,
        opacity: 0.8,
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
      !Number.isFinite(position.longitude)
    )
      return;

    post({
      type: "setUserMarker",
      lat: position.latitude,
      lng: position.longitude,
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

        suppressMapMove.current = true;
        post({
          type: "panTo",
          lat: position.latitude,
          lng: position.longitude,
          zoom: targetZoom,
          bearing,
          animate: shouldAnimateZoom,
          duration: shouldAnimateZoom ? 0.45 : 0,
        });
      })();
    }
  }, [position, following, mapReady, targetZoom]);

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
      <View className="flex-1">
        <ShadcnMap ref={mapRef} initialZoom={2} onMapMessage={handleMapMsg} />
        <View className="absolute inset-0 items-center">
          <Svg height={320} className="pointer-events-none" width="100%">
            <Defs>
              <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="0.6">
                <Stop offset="0" stopColor={warningColor} stopOpacity="0.96" />
                <Stop offset="1" stopColor={warningColor} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
          </Svg>
          <View className="absolute top-0 left-0 right-0">
            <View className="mx-4 mt-12 rounded-xl bg-[#12202a]/80 p-4 flex-row items-center">
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
              </View>
            </View>
          </View>
        </View>
      </View>

      {isCarMode && speedLimit && (
        <Animated.View className="absolute left-4 items-center justify-center rounded-full bg-[#12202a]/80">
          <View className="w-16 h-16 items-center justify-center rounded-full bg-[#0d7ff2]">
            <Text className="text-white font-bold">{speedLimit}</Text>
          </View>
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
        <BottomSheetView className="flex-1 px-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-white text-lg font-medium">
                {routeService.isCalculating
                  ? "…"
                  : formatDuration(totalDuration)}
              </Text>
              <Text className="text-gray-400" numberOfLines={1}>
                {formatDistance(totalDistance)}
                {etaLabel ? ` • ${t("eta", { time: etaLabel })}` : ""}
              </Text>
            </View>
            <TouchableOpacity
              className="flex-row items-center rounded-lg bg-[#0d7ff2] px-3 py-2"
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
              <Text className="text-white"> {t("addStop")}</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center justify-content">
            {!following ? (
              <TouchableOpacity
                className="flex-row items-center rounded-lg bg-[#0d7ff2] px-3 py-2"
                onPress={() => setFollowing(true)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="my-location" size={18} color="#fff" />
                <Text className="text-white">{t("recenter")}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  className="flex-row items-center rounded-lg bg-[#0d7ff2] px-3 py-2"
                  onPress={handleRoutes}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="alt-route" size={18} color="#fff" />
                  <Text className="text-white">{t("route")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center rounded-lg bg-[#0d7ff2] px-3 py-2"
                  onPress={handleStopTrip}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="stop" size={18} color="#fff" />
                  <Text className="text-white">{t("stopTrip")}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View className="h-px bg-gray-600" />

          <View className="flex-1 py-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white font-medium">{t("mapStyle")}</Text>
              <MaterialIcons name="layers" size={20} color="#8a8a8a" />
            </View>

            <View className="flex-row items-center justify-start mb-4">
              <TouchableOpacity
                className={cn(
                  "flex-row items-center rounded-lg bg-[#0d7ff2] px-3 py-2",
                  baseLayer === "standard" && "bg-[#0d7ff2]",
                )}
                onPress={() => layers.setMapType("standard")}
              >
                <Text
                  className={cn(
                    "text-white",
                    baseLayer === "standard" && "text-white",
                  )}
                >
                  {t("layerStandard")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={cn(
                  "flex-row items-center rounded-lg bg-[#0d7ff2] px-3 py-2 ml-3",
                  baseLayer === "satellite" && "bg-[#0d7ff2]",
                )}
                onPress={() => layers.setMapType("satellite")}
              >
                <Text
                  className={cn(
                    "text-white",
                    baseLayer === "satellite" && "text-white",
                  )}
                >
                  {t("layerSatellite")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={cn(
                  "flex-row items-center rounded-lg bg-[#0d7ff2] px-3 py-2 ml-3",
                  baseLayer === "terrain" && "bg-[#0d7ff2]",
                )}
                onPress={() => layers.setMapType("terrain")}
              >
                <Text
                  className={cn(
                    "text-white",
                    baseLayer === "terrain" && "text-white",
                  )}
                >
                  {t("layerTerrain")}
                </Text>
              </TouchableOpacity>
            </View>

            {baseLayer !== "satellite" && (
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white">{t("darkMode")}</Text>
                <Switch
                  value={themeMode === "dark"}
                  onValueChange={() => layers.setDarkTheme(!layers.darkTheme)}
                  trackColor={{ false: "#444", true: Colors.dark.primary }}
                  thumbColor="#fff"
                />
              </View>
            )}

            <View className="flex-1">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-white">{t("guideVolume")}</Text>
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

              <View className="flex-row items-center justify-between">
                <TouchableOpacity
                  className={cn(
                    "flex-row items-center rounded-lg bg-[#0d7ff2] px-3 py-2",
                    guideMode === "off" && "bg-[#0d7ff2]",
                  )}
                  onPress={() => setGuideMode("off")}
                >
                  <Text
                    className={cn(
                      "text-white",
                      guideMode === "off" && "text-white",
                    )}
                  >
                    {t("volumeMute")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={cn(
                    "flex-row items-center rounded-lg bg-[#0d7ff2] px-3 py-2 ml-3",
                    guideMode === "alert" && "bg-[#0d7ff2]",
                  )}
                  onPress={() => {
                    setGuideMode("alert");
                  }}
                >
                  <Text
                    className={cn(
                      "text-white",
                      guideMode === "alert" && "text-white",
                    )}
                  >
                    {t("volumeAlerts")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={cn(
                    "flex-row items-center rounded-lg bg-[#0d7ff2] px-3 py-2 ml-3",
                    guideMode === "all" && "bg-[#0d7ff2]",
                  )}
                  onPress={() => {
                    setGuideMode("all");
                  }}
                >
                  <Text
                    className={cn(
                      "text-white",
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
            data={routeService.getNavigationData()?.steps || []}
            keyExtractor={(item: any, index: number) => index.toString()}
            renderItem={({
              item: s,
              index: i,
            }: {
              item: any;
              index: number;
            }) => {
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
