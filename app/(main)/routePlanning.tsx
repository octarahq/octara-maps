import {
  AddressIcon,
  BusStopIcon,
  CityIcon,
  CommercialIcon,
  FoodIcon,
  GasIcon,
  HealthIcon,
  ParkingIcon,
  TrainStationIcon,
} from "@/assets/icons";
import MapSnapshot, { WaypointPin } from "@/components/MapSnapshot";
import { Colors } from "@/constants/theme";
import { usePosition } from "@/contexts/PositionContext";
import { useUser } from "@/contexts/UserContext";
import { createTranslator } from "@/i18n";
import { showCommingSoonToast } from "@/utils/commingSoonToast";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Keyboard,
  KeyboardEvent,
  LayoutAnimation,
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Coordinate } from "../../services/RouteService";
import { useRouteService } from "../../services/RouteService";
import {
  PhotonFeature,
  SearchEngineService,
} from "../../services/SearchEngineService";

const { t } = createTranslator("routePlanning");

function getPhotonIcon(r: PhotonFeature): React.ReactNode {
  const v = r.properties?.osm_value ?? "";
  const noStreet = !r.properties?.housenumber && !r.properties?.street;

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
    ].includes(v) || /\bquai\b/i.test(r.properties?.street ?? "");

  if (v === "bus_stop") return <BusStopIcon />;
  if (isStation) return <TrainStationIcon />;
  if (
    ["restaurant", "fast_food", "cafe", "bar", "pub", "food_court"].includes(v)
  )
    return <FoodIcon />;
  if (
    [
      "retail",
      "supermarket",
      "bakery",
      "convenience",
      "pharmacy",
      "clothes",
    ].includes(v)
  )
    return <CommercialIcon />;
  if (["hospital", "clinic", "pharmacy", "doctors"].includes(v))
    return <HealthIcon />;
  if (v === "parking") return <ParkingIcon />;
  if (v === "fuel") return <GasIcon />;
  if (noStreet) return <CityIcon />;
  return <AddressIcon />;
}

type TransportMode = "car" | "walk" | "bike" | "transit";

const MODES: { id: TransportMode; icon: string }[] = [
  { id: "car", icon: "directions-car" },
  { id: "walk", icon: "directions-walk" },
  { id: "bike", icon: "directions-bike" },
  { id: "transit", icon: "directions-bus" },
];

type PlaceResult = { name: string; address: string; lat: number; lng: number };
type StopRole = "departure" | "waypoint" | "destination";
type StopItem = {
  id: string;
  result: PlaceResult | null;
  role: StopRole;
  isCurrentPosition: boolean;
};

const ITEM_HEIGHT = 68;
const ITEM_GAP = 10;
const STEP = ITEM_HEIGHT + ITEM_GAP;

interface StopRowProps {
  stop: StopItem;
  index: number;
  totalCount: number;
  dragIndex: SharedValue<number>;
  dragAbsY: SharedValue<number>;
  isEditing: boolean;
  editQuery: string;
  autocompleteResults: PhotonFeature[];
  rowLabel: string;
  canRemove: boolean;
  canUseCurrentPosition: boolean;
  onDragStart: () => void;
  onDragFinish: () => void;
  onEditActivate: () => void;
  onSelectCurrentPosition: () => void;
  onQueryChange: (q: string) => void;
  onSelectResult: (r: PhotonFeature) => void;
  onRemove: () => void;
  onDragEnd: (from: number, to: number) => void;
}

function StopRow({
  stop,
  index,
  totalCount,
  dragIndex,
  dragAbsY,
  isEditing,
  editQuery,
  autocompleteResults,
  rowLabel,
  canRemove,
  canUseCurrentPosition,
  onDragStart,
  onDragFinish,
  onEditActivate,
  onSelectCurrentPosition,
  onQueryChange,
  onSelectResult,
  onRemove,
  onDragEnd,
}: StopRowProps) {
  const role = stop.role;

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(150)
    .onBegin(() => {
      dragIndex.value = index;
      dragAbsY.value = index * STEP;
      runOnJS(onDragStart)();
    })
    .onUpdate((e) => {
      dragAbsY.value = index * STEP + e.translationY;
    })
    .onEnd(() => {
      const to = Math.max(
        0,
        Math.min(totalCount - 1, Math.round(dragAbsY.value / STEP)),
      );
      runOnJS(onDragEnd)(dragIndex.value, to);
      dragIndex.value = -1;
      dragAbsY.value = 0;
    })
    .onFinalize(() => {
      dragIndex.value = -1;
      dragAbsY.value = 0;
      runOnJS(onDragFinish)();
    });

  const inputRef = React.useRef<import("react-native").TextInput>(null);
  React.useEffect(() => {
    if (isEditing) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  const animStyle = useAnimatedStyle(() => {
    const dragging = dragIndex.value;
    if (dragging === index) {
      return {
        transform: [{ translateY: dragAbsY.value - index * STEP }],
        zIndex: 100,
        shadowOpacity: 0.5,
        shadowRadius: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
      };
    }
    if (dragging === -1) {
      return {
        transform: [{ translateY: 0 }],
        zIndex: 1,
        shadowOpacity: 0,
        elevation: 0,
      };
    }
    const targetPos = Math.round(dragAbsY.value / STEP);
    let offset = 0;
    if (dragging < index && targetPos >= index) offset = -STEP;
    else if (dragging > index && targetPos <= index) offset = STEP;
    return {
      transform: [{ translateY: offset }],
      zIndex: 1,
      shadowOpacity: 0,
      elevation: 0,
    };
  });

  const iconBoxExtra = stop.isCurrentPosition
    ? { backgroundColor: "rgba(13,127,242,0.12)" }
    : role === "destination"
      ? { backgroundColor: Colors.dark.primary }
      : {};
  const iconName = stop.isCurrentPosition
    ? "my-location"
    : role === "destination"
      ? "flag"
      : "location-on";
  const iconColor = stop.isCurrentPosition
    ? Colors.dark.primary
    : role === "destination"
      ? "#fff"
      : "#90adcb";
  const labelColor = role === "destination" ? Colors.dark.primary : undefined;

  const placeholder =
    role === "departure"
      ? t("currentPosition")
      : role === "destination"
        ? t("destination")
        : t("choosePlace");

  return (
    <View
      className="relative overflow-visible"
      style={[
        isEditing &&
          (canUseCurrentPosition || autocompleteResults.length > 0) && {
            zIndex: 200,
          },
      ]}
    >
      <Animated.View
        className="flex-row items-center gap-[14px] bg-[#12202a] rounded-[16px] px-4 py-[14px] border border-white/10"
        style={[animStyle]}
      >
        <View
          className="w-10 h-10 rounded-[10px] bg-[#1e3040] items-center justify-center"
          style={[iconBoxExtra]}
        >
          <MaterialIcons name={iconName as any} size={20} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text
            className="text-[#90adcb] text-[10px] font-semibold tracking-widest uppercase mb-[2px]"
            style={[labelColor ? { color: labelColor } : {}]}
          >
            {rowLabel}
          </Text>
          {isEditing ? (
            <TextInput
              ref={inputRef}
              value={editQuery}
              onChangeText={onQueryChange}
              className="text-white text-[15px] font-medium py-[2px] border-b border-primary mt-[2px]"
              placeholder={t("searchPlacePlaceholder")}
              placeholderTextColor="#90adcb"
              returnKeyType="search"
            />
          ) : (
            <TouchableOpacity onPress={onEditActivate} hitSlop={4}>
              <Text
                className="text-white text-[15px] font-semibold"
                style={[
                  !stop.result &&
                    !stop.isCurrentPosition && { color: "#90adcb" },
                ]}
              >
                {stop.isCurrentPosition
                  ? t("currentPosition")
                  : (stop.result?.name ?? placeholder)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <GestureDetector gesture={panGesture}>
            <View className="p-1">
              <MaterialIcons
                name="drag-handle"
                size={22}
                color={isEditing ? "rgba(255,255,255,0.2)" : "#90adcb"}
              />
            </View>
          </GestureDetector>
          {canRemove ? (
            <TouchableOpacity onPress={onRemove} hitSlop={8}>
              <MaterialIcons name="close" size={20} color="#90adcb" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 20 }} />
          )}
        </View>
      </Animated.View>

      {isEditing &&
        (canUseCurrentPosition || autocompleteResults.length > 0) && (
          <View
            className="absolute left-0 right-0 bg-[#0e1f2e] rounded-[10px] border border-white/10 overflow-hidden z-[200] elevation-[16]"
            style={{ top: ITEM_HEIGHT + 2 }}
          >
            {canUseCurrentPosition && (
              <TouchableOpacity
                className="flex-row items-center gap-[10px] px-3 py-2"
                style={[
                  autocompleteResults.length > 0 && {
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(255,255,255,0.06)",
                  },
                ]}
                onPress={onSelectCurrentPosition}
              >
                <View
                  className="w-9 h-9 rounded-[10px] bg-[#223649] items-center justify-center"
                  style={[{ backgroundColor: "rgba(13,127,242,0.15)" }]}
                >
                  <MaterialIcons
                    name="my-location"
                    size={18}
                    color={Colors.dark.primary}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-white text-[14px] font-medium">
                    {t("myPositionTitle")}
                  </Text>
                  <Text className="text-[#90adcb] text-[12px] mt-[1px]">
                    {t("useMyLocation")}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            {autocompleteResults.slice(0, 5).map((r, ri) => {
              const rName =
                r.properties?.name ||
                [r.properties?.housenumber, r.properties?.street]
                  .filter(Boolean)
                  .join(" ") ||
                r.properties?.city ||
                t("place");
              const rSub = [r.properties?.city, r.properties?.country]
                .filter(Boolean)
                .join(", ");
              return (
                <TouchableOpacity
                  key={`${r.properties?.osm_id ?? ri}`}
                  className="flex-row items-center gap-[10px] px-3 py-2"
                  style={[
                    ri < autocompleteResults.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: "rgba(255,255,255,0.06)",
                    },
                  ]}
                  onPress={() => onSelectResult(r)}
                >
                  <View className="w-9 h-9 rounded-[10px] bg-[#223649] items-center justify-center">
                    {getPhotonIcon(r)}
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-white text-[14px] font-medium"
                      numberOfLines={1}
                    >
                      {rName}
                    </Text>
                    {rSub ? (
                      <Text
                        className="text-[#90adcb] text-[12px] mt-[1px]"
                        numberOfLines={1}
                      >
                        {rSub}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
    </View>
  );
}

export default function RoutePlanningScreen() {
  const { name, address, lat, lng } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings } = useUser();

  const destLat = lat ? parseFloat(lat as string) : null;
  const destLng = lng ? parseFloat(lng as string) : null;
  const destName = (name as string) || "";
  const destAddress =
    (address as string) || (lat && lng ? `${lat}, ${lng}` : "");

  const [selected, setSelected] = React.useState<TransportMode>(
    settings.favTransportMode ?? "car",
  );
  const [showPlanner, setShowPlanner] = React.useState(false);
  const [mapExpanded, setMapExpanded] = React.useState(false);
  const { position } = usePosition();

  const expandAnim = useSharedValue(0);

  const toggleMapExpand = () => {
    const next = mapExpanded ? 0 : 1;
    expandAnim.value = withTiming(next, {
      duration: 320,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: "easeInEaseOut", property: "opacity" },
      update: { type: "easeInEaseOut" },
      delete: { type: "easeInEaseOut", property: "opacity" },
    });
    setMapExpanded((v) => !v);
  };

  const editBtnAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandAnim.value, [0, 0.35], [1, 0]),
    maxHeight: interpolate(expandAnim.value, [0, 0.55], [80, 0]),
    overflow: "hidden",
  }));

  const routeService = useRouteService();

  const routeServiceRef = React.useRef(routeService);
  React.useEffect(() => {
    routeServiceRef.current = routeService;
  }, [routeService]);

  const [routeResults, setRouteResults] = React.useState<
    Partial<
      Record<
        TransportMode,
        { duration: number; distance: number; coords: Coordinate[] }
      >
    >
  >({});
  const [routeErrors, setRouteErrors] = React.useState<
    Partial<Record<TransportMode, string>>
  >({});

  const [routeAlternatives, setRouteAlternatives] = React.useState<
    Partial<
      Record<
        TransportMode,
        { duration: number; distance: number; coords: Coordinate[] }[]
      >
    >
  >({});

  const [selectedAlternativeIndex, setSelectedAlternativeIndex] =
    React.useState<Partial<Record<TransportMode, number>>>({
      car: 0,
      walk: 0,
      bike: 0,
    });

  const [modesCalculating, setModesCalculating] = React.useState({
    car: false,
    walk: false,
    bike: false,
  });

  const modeToService = (m: TransportMode): string =>
    m === "car" ? "driving" : m === "walk" ? "walking" : "bicycling";

  const getFastestMode = (): TransportMode | null => {
    const modes: TransportMode[] = ["car", "walk", "bike"];
    const durations = modes
      .filter((mode) => routeResults[mode])
      .map((mode) => ({
        mode,
        duration: routeResults[mode]!.duration,
      }));

    if (durations.length === 0) return null;
    return durations.reduce((fastest, current) =>
      current.duration < fastest.duration ? current : fastest,
    ).mode;
  };

  const handleSelectAlternative = (mode: TransportMode, index: number) => {
    const alternatives = routeAlternatives[mode];
    if (!alternatives || index < 0 || index >= alternatives.length) return;

    setSelectedAlternativeIndex((prev) => ({
      ...prev,
      [mode]: index,
    }));

    setRouteResults((prev) => ({
      ...prev,
      [mode]: {
        duration: alternatives[index].duration,
        distance: alternatives[index].distance,
        coords: alternatives[index].coords,
      },
    }));
  };

  const formatDuration = (min: number): string => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const [waypoints, setWaypoints] = React.useState<StopItem[]>(() => [
    {
      id: "departure",
      result: null,
      role: "departure",
      isCurrentPosition: true,
    },
    {
      id: "destination",
      result:
        destLat && destLng
          ? {
              name: destName || destAddress || t("destination"),
              address: destAddress,
              lat: destLat,
              lng: destLng,
            }
          : null,
      role: "destination",
      isCurrentPosition: false,
    },
  ]);

  const [activeEditIndex, setActiveEditIndex] = React.useState<number | null>(
    null,
  );
  const [editQuery, setEditQuery] = React.useState("");
  const [autocompleteResults, setAutocompleteResults] = React.useState<
    PhotonFeature[]
  >([]);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);

  React.useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (_e: KeyboardEvent) =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const activeEditIndexRef = React.useRef(activeEditIndex);
  const editQueryRef = React.useRef(editQuery);
  React.useEffect(() => {
    activeEditIndexRef.current = activeEditIndex;
  }, [activeEditIndex]);
  React.useEffect(() => {
    editQueryRef.current = editQuery;
  }, [editQuery]);

  React.useEffect(() => {
    if (
      !keyboardVisible &&
      activeEditIndexRef.current !== null &&
      editQueryRef.current.trim() === ""
    ) {
      setActiveEditIndex(null);
      setAutocompleteResults([]);
    }
  }, [keyboardVisible]);

  const [scrollEnabled, setScrollEnabled] = React.useState(true);
  const dragIndex = useSharedValue(-1);
  const dragAbsY = useSharedValue(0);

  React.useEffect(() => {
    const q = editQuery.trim();
    if (!q) {
      setAutocompleteResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await SearchEngineService.photonSearch(q, { limit: 5 });
        setAutocompleteResults(results);
      } catch {
        setAutocompleteResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [editQuery]);

  const addStop = () => {
    const lastIdx = waypoints.length - 1;
    const dest = waypoints[lastIdx];

    if (!dest.result && !dest.isCurrentPosition) {
      setActiveEditIndex(lastIdx);
      setEditQuery("");
      setAutocompleteResults([]);
      return;
    }
    const insertIdx = waypoints.length - 1;
    const newStop: StopItem = {
      id: String(Date.now()),
      result: null,
      role: "waypoint",
      isCurrentPosition: false,
    };
    setWaypoints((prev) => {
      const next = [...prev];
      next.splice(insertIdx, 0, newStop);
      return next;
    });
    setActiveEditIndex(insertIdx);
    setEditQuery("");
    setAutocompleteResults([]);
  };

  const removeStop = (i: number) => {
    if (i === 0 || i === waypoints.length - 1) return;
    setWaypoints((prev) => prev.filter((_, idx) => idx !== i));
    if (activeEditIndex === i) {
      setActiveEditIndex(null);
      setEditQuery("");
      setAutocompleteResults([]);
    } else if (activeEditIndex !== null && activeEditIndex > i) {
      setActiveEditIndex(activeEditIndex - 1);
    }
  };

  const reorderStops = (from: number, to: number) => {
    setScrollEnabled(true);
    if (from === to) return;

    setWaypoints((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);

      let reordered = next.map((w, i) => ({
        ...w,
        role:
          i === 0
            ? "departure"
            : i === next.length - 1
              ? "destination"
              : "waypoint",
      })) as StopItem[];

      const last = reordered[reordered.length - 1];
      if (!last.result && !last.isCurrentPosition && reordered.length > 2) {
        reordered = reordered.slice(0, -1);
        reordered[reordered.length - 1] = {
          ...reordered[reordered.length - 1],
          role: "destination",
        };
      }
      return reordered;
    });

    setActiveEditIndex(null);
    setEditQuery("");
    setAutocompleteResults([]);
  };

  const handleSelectResult = (wpIndex: number, r: PhotonFeature) => {
    const result: PlaceResult = {
      name:
        r.properties?.name ||
        [r.properties?.housenumber, r.properties?.street]
          .filter(Boolean)
          .join(" ") ||
        r.properties?.city ||
        t("place"),
      address: [
        r.properties?.housenumber,
        r.properties?.street,
        r.properties?.city,
        r.properties?.country,
      ]
        .filter(Boolean)
        .join(", "),
      lat: r.geometry.coordinates[1],
      lng: r.geometry.coordinates[0],
    };
    setWaypoints((prev) =>
      prev.map((s, i) =>
        i === wpIndex ? { ...s, result, isCurrentPosition: false } : s,
      ),
    );
    setActiveEditIndex(null);
    setEditQuery("");
    setAutocompleteResults([]);
    Keyboard.dismiss();
  };

  const handleEditActivate = (i: number) => {
    setActiveEditIndex(i);
    setEditQuery(waypoints[i]?.result?.name ?? "");
    setAutocompleteResults([]);
  };

  const handleSelectCurrentPosition = (i: number) => {
    setWaypoints((prev) =>
      prev.map((s, idx) =>
        idx === i ? { ...s, result: null, isCurrentPosition: true } : s,
      ),
    );
    setActiveEditIndex(null);
    setEditQuery("");
    setAutocompleteResults([]);
    Keyboard.dismiss();
  };

  const departure = waypoints[0]?.result ?? null;
  const destinationStop = waypoints[waypoints.length - 1];
  const destinationResult = destinationStop?.result ?? null;
  const destinationCoords =
    destinationResult &&
    Number.isFinite(destinationResult.lat) &&
    Number.isFinite(destinationResult.lng)
      ? { lat: destinationResult.lat, lng: destinationResult.lng }
      : null;
  const destinationLabel =
    destinationResult?.name ?? destAddress ?? t("destination");
  const navigationModeForIntent = selected === "transit" ? "car" : selected;

  const handleStartNavigation = async () => {
    if (!destinationCoords) return;

    const coords: Coordinate[] = summaryWaypoints
      .map((w) => {
        if (w.isCurrentPosition && gpsSnapshot) {
          return { latitude: gpsSnapshot.lat, longitude: gpsSnapshot.lng };
        }
        if (w.result) {
          return { latitude: w.result.lat, longitude: w.result.lng };
        }
        return null;
      })
      .filter((c): c is Coordinate => c !== null);

    try {
      /* telemetry removed */;

      if (coords.length > 2) {
        await routeService.getMultiStepRoute(coords, navigationModeForIntent);
      } else {
        const selectedRoute = routeResults[navigationModeForIntent];
        if (selectedRoute) {
          routeService.updateRouteData({
            routes: [
              {
                geometry: {
                  coordinates: selectedRoute.coords.map((c) => [
                    c.longitude,
                    c.latitude,
                  ]),
                },
                duration: selectedRoute.duration * 60,
                distance: selectedRoute.distance,
              },
            ],
          });
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      /* telemetry removed */;
    }

    router.push({
      pathname: "/navigate/standard",
      params: {
        lat: String(destinationCoords.lat),
        lng: String(destinationCoords.lng),
        mode: navigationModeForIntent,
        name: destinationLabel,
        multi: coords.length > 2 ? "1" : undefined,
      },
    });
  };

  const validCount = waypoints.filter(
    (w) => w.result !== null || w.isCurrentPosition,
  ).length;
  const canSave = validCount >= 2;

  const summaryWaypoints = React.useMemo(
    () => [
      waypoints[0],
      ...waypoints
        .slice(1, -1)
        .filter((w) => w.result !== null || w.isCurrentPosition),
      waypoints[waypoints.length - 1],
    ],
    [waypoints],
  );

  const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

  const [gpsSnapshot, setGpsSnapshot] = React.useState<{
    lat: number;
    lng: number;
  } | null>(
    position
      ? { lat: round4(position.latitude), lng: round4(position.longitude) }
      : null,
  );

  React.useEffect(() => {
    if (position && !gpsSnapshot) {
      setGpsSnapshot({
        lat: round4(position.latitude),
        lng: round4(position.longitude),
      });
    }
  }, [position, gpsSnapshot]);

  const prevSummaryRef = React.useRef(summaryWaypoints);
  React.useEffect(() => {
    if (summaryWaypoints !== prevSummaryRef.current) {
      prevSummaryRef.current = summaryWaypoints;
      if (position) {
        setGpsSnapshot({
          lat: round4(position.latitude),
          lng: round4(position.longitude),
        });
      }
    }
  }, [summaryWaypoints, position]);

  const posLat = gpsSnapshot?.lat ?? null;
  const posLng = gpsSnapshot?.lng ?? null;
  const resolvedCoords = React.useMemo<Coordinate[]>(
    () =>
      summaryWaypoints
        .map((w): Coordinate | null => {
          if (w.isCurrentPosition && posLat !== null && posLng !== null)
            return { latitude: posLat, longitude: posLng };
          if (w.result)
            return { latitude: w.result.lat, longitude: w.result.lng };
          return null;
        })
        .filter((c): c is Coordinate => c !== null),
    [summaryWaypoints, posLat, posLng],
  );

  const lastFetchKey = React.useRef("");

  const prevCoordsKey = React.useRef("");
  React.useEffect(() => {
    const key = JSON.stringify(resolvedCoords);
    if (key !== prevCoordsKey.current) {
      prevCoordsKey.current = key;
      lastFetchKey.current = "";
      setRouteResults({});
    }
  }, [resolvedCoords]);

  React.useEffect(() => {
    if (resolvedCoords.length < 2) return;
    const key = JSON.stringify(resolvedCoords);
    if (key === lastFetchKey.current) return;
    lastFetchKey.current = key;

    setRouteResults({});
    setRouteErrors({});

    const modes: ("car" | "walk" | "bike")[] = ["car", "walk", "bike"];
    setModesCalculating({ car: true, walk: true, bike: true });

    /* telemetry removed */;

    let completed = 0;
    let successCount = 0;
    const distances: number[] = [];
    const durations: number[] = [];

    modes.forEach((mode, index) => {
      const delay = index * 300;
      setTimeout(async () => {
        try {
          const alternatives = await routeService.getRoutes(
            resolvedCoords,
            modeToService(mode as TransportMode),
            { alternatives: 3 },
          );

          if (alternatives && alternatives.length > 0) {
            successCount++;
            distances.push(alternatives[0].distance);
            durations.push(alternatives[0].duration);

            setRouteAlternatives((prev) => ({
              ...prev,
              [mode as TransportMode]: alternatives,
            }));

            setSelectedAlternativeIndex((prev) => ({
              ...prev,
              [mode]: 0,
            }));

            setRouteResults((prev) => ({
              ...prev,
              [mode as TransportMode]: {
                duration: alternatives[0].duration,
                distance: alternatives[0].distance,
                coords: alternatives[0].coords,
              },
            }));
          } else {
            /* telemetry removed */;
            setRouteErrors((prev) => ({
              ...prev,
              [mode as TransportMode]: t("errorNoRoute"),
            }));
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          /* telemetry removed */;
          setRouteErrors((prev) => ({
            ...prev,
            [mode as TransportMode]: errorMsg,
          }));
        } finally {
          completed++;
          if (completed === modes.length) {
            /* telemetry removed */;
          }
        }

        setModesCalculating((prev) => ({
          ...prev,
          [mode]: false,
        }));
      }, delay);
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedCoords]);

  const prevSelectedRouteKey = React.useRef("");
  React.useEffect(() => {
    if (selected === "transit") return;
    const selectedRoute = routeResults[selected];
    if (!selectedRoute) return;

    const key = JSON.stringify({
      d: selectedRoute.duration,
      dist: selectedRoute.distance,
      c: selectedRoute.coords?.length ?? 0,
    });
    if (key === prevSelectedRouteKey.current) return;
    prevSelectedRouteKey.current = key;

    routeServiceRef.current.updateRouteData({
      routes: [
        {
          geometry: {
            coordinates: selectedRoute.coords.map((c) => [
              c.longitude,
              c.latitude,
            ]),
          },
          duration: selectedRoute.duration * 60,
          distance: selectedRoute.distance,
        },
      ],
    });
  }, [selected, routeResults]);
  const mapPins = React.useMemo<WaypointPin[]>(() => {
    let stepIdx = 1;
    return summaryWaypoints
      .map((w) => {
        const coords = w.isCurrentPosition
          ? position
            ? { lat: position.latitude, lng: position.longitude }
            : null
          : w.result
            ? { lat: w.result.lat, lng: w.result.lng }
            : null;
        if (!coords) return null;
        const type: WaypointPin["type"] =
          w.role === "departure"
            ? "departure"
            : w.role === "destination"
              ? "destination"
              : "waypoint";
        const pin: WaypointPin = { ...coords, type };
        if (type === "waypoint") pin.stepNumber = stepIdx++;
        return pin;
      })
      .filter(Boolean) as WaypointPin[];
  }, [summaryWaypoints, position]);

  return (
    <View className="flex-1 bg-[#101922]">
      <StatusBar
        hidden
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <View
        className="flex-row items-center justify-between px-4 pb-3 border-b"
        style={[
          {
            paddingTop: insets.top + 8,
            borderBottomColor: "rgba(255,255,255,0.08)",
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-12 h-12 rounded-full items-center justify-center"
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-[18px] font-bold flex-1 text-center">
          {t("optionsTitle")}
        </Text>
        <View className="w-12 h-12 rounded-full items-center justify-center" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 0, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!mapExpanded}
      >
        {mapExpanded ? (
          <View className="flex-col gap-0 bg-[#12202a] rounded-[16px] padding-[14px] border border-white/[0.07] mb-5">
            <View className="flex-row items-center justify-between mb-[10px] gap-2">
              <View className="flex-1 gap-[2px]">
                <Text className="text-[#90adcb] text-[10px] font-semibold tracking-widest uppercase">
                  {t("summaryLabel")}
                </Text>
                {selected !== "transit" && (
                  <View className="flex-row items-center gap-[6px] mt-1">
                    {modesCalculating[selected] ? (
                      <Text className="text-[#90adcb] text-[13px] italic">
                        {t("calculating")}
                      </Text>
                    ) : routeResults[selected] ? (
                      <>
                        <Text className="text-white text-[15px] font-bold">
                          {formatDuration(routeResults[selected]!.duration)}
                        </Text>
                        <Text className="text-[#90adcb] text-[15px] mx-1">
                          ·
                        </Text>
                        <Text className="text-[#90adcb] text-[13px]">
                          {formatDistance(routeResults[selected]!.distance)}
                        </Text>
                      </>
                    ) : null}
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={toggleMapExpand}
                hitSlop={12}
                className="p-1"
              >
                <MaterialIcons
                  name="fullscreen-exit"
                  size={20}
                  color="#90adcb"
                />
              </TouchableOpacity>
            </View>

            <View className="rounded-[12px] border border-white/10 overflow-hidden mb-0">
              <MapSnapshot
                pins={mapPins}
                routeCoords={
                  routeService.routeCoords.length >= 2
                    ? routeService.routeCoords
                    : undefined
                }
                interactive
                style={{ height: 278 }}
              />
            </View>
          </View>
        ) : (
          <>
            <View className="flex-row gap-3 bg-[#12202a] rounded-[16px] p-4 border border-white/[0.07] mb-5">
              <View className="flex-1 gap-[6px]">
                <Text className="text-[#90adcb] text-[10px] font-semibold tracking-widest uppercase">
                  {t("summaryLabel")}
                </Text>
                {destName ? (
                  <Text
                    className="text-white text-[17px] font-bold leading-[22px]"
                    numberOfLines={2}
                  >
                    {destName}
                  </Text>
                ) : null}

                {summaryWaypoints.map((wp, wi) => {
                  const isFirst = wi === 0;
                  const isLast = wi === summaryWaypoints.length - 1;
                  const label = wp.isCurrentPosition
                    ? t("currentPosition")
                    : isFirst
                      ? (wp.result?.name ?? t("currentPosition"))
                      : (wp.result?.name ?? t("destination"));
                  return (
                    <View
                      key={wp.id}
                      className="flex-row items-start gap-2 min-h-[20px]"
                    >
                      <View className="w-3 items-center pt-[3px]">
                        <View
                          className="w-2 h-2 rounded-full bg-[#4a6a84]"
                          style={[
                            isFirst && { backgroundColor: Colors.dark.primary },
                            isLast && {
                              backgroundColor: "#e3e3e3",
                              borderRadius: 2,
                            },
                          ]}
                        />
                        {!isLast && (
                          <View className="w-[2px] flex-1 min-h-[10px] bg-white/[0.2] mt-[2px] -mb-1" />
                        )}
                      </View>
                      <Text
                        className="text-[#90adcb] text-[13px] flex-1 pb-1.5"
                        style={[isFirst && { color: "#fff" }]}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                    </View>
                  );
                })}

                {selected !== "transit" && (
                  <View className="flex-row items-center gap-[6px] mt-1">
                    {modesCalculating[selected] ? (
                      <Text className="text-[#90adcb] text-[13px] italic">
                        {t("calculating")}
                      </Text>
                    ) : routeResults[selected] ? (
                      <>
                        <Text className="text-white text-[15px] font-bold">
                          {formatDuration(routeResults[selected]!.duration)}
                        </Text>
                        <Text className="text-[#90adcb] text-[15px] mx-1">
                          ·
                        </Text>
                        <Text className="text-[#90adcb] text-[13px]">
                          {formatDistance(routeResults[selected]!.distance)}
                        </Text>
                      </>
                    ) : null}
                  </View>
                )}
              </View>

              <TouchableOpacity
                className="flex-1.5 bg-transparent"
                style={{ flex: 1.5 }}
                onPress={toggleMapExpand}
                activeOpacity={0.85}
              >
                <View className="rounded-[12px] border border-white/10 overflow-hidden">
                  <MapSnapshot
                    pins={mapPins}
                    routeCoords={
                      routeService.routeCoords.length >= 2
                        ? routeService.routeCoords
                        : undefined
                    }
                  />
                </View>
              </TouchableOpacity>
            </View>

            <Animated.View style={editBtnAnimStyle}>
              <TouchableOpacity
                className="flex-row items-center gap-2 self-start px-[14px] py-2 rounded-[20px] border border-white/10 bg-white/[0.04] mb-5"
                onPress={() => setShowPlanner(true)}
                activeOpacity={0.75}
              >
                <MaterialIcons name="edit-road" size={18} color="#90adcb" />
                <Text className="text-[#90adcb] text-[13px] font-semibold flex-1">
                  {t("editStops")}
                </Text>
                <MaterialIcons name="chevron-right" size={18} color="#90adcb" />
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white text-[17px] font-bold">
            {t("modesTitle")}
          </Text>
        </View>

        <View className="gap-[10px]">
          {MODES.map((mode) => {
            const isSelected = selected === mode.id;
            const altsCount = routeAlternatives[mode.id]?.length ?? 0;
            const hasMultipleAlts = mode.id !== "transit" && altsCount > 1;

            if (isSelected && hasMultipleAlts) {
              const alternatives = routeAlternatives[mode.id] ?? [];
              return (
                <View
                  key={mode.id}
                  className="flex-col bg-[#12202a] rounded-[16px] p-4 border-2 border-primary mb-3 elevation-6 shadow-primary shadow-opacity-25 shadow-radius-10"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-[14px] flex-1">
                      <View className="w-12 h-12 rounded-[12px] bg-primary items-center justify-center mr-3">
                        <MaterialIcons
                          name={mode.icon as any}
                          size={28}
                          color="#fff"
                        />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-white text-[15px] font-bold">
                            {t(`modes.${mode.id}.label`)}
                          </Text>
                          {getFastestMode() === mode.id ? (
                            <View className="bg-primary/20 rounded-[4px] px-[6px] py-[2px]">
                              <Text className="text-primary text-[9px] font-extrabold uppercase">
                                {t("fastest")}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text className="text-primary text-[13px] mt-[2px]">
                          {t(`modes.${mode.id}.subtitle`)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="h-[1px] bg-white/10 my-3" />

                  {alternatives.length > 1 ? (
                    <View className="gap-[10px] mb-5">
                      {alternatives.map((alt, idx) => {
                        const isSelectedAlt =
                          selectedAlternativeIndex[mode.id] === idx;
                        return (
                          <TouchableOpacity
                            key={idx}
                            className="flex-row items-center justify-between px-3 py-[10px] bg-white/[0.04] rounded-[12px] border border-white/10"
                            style={[
                              isSelectedAlt && {
                                backgroundColor: "rgba(13,127,242,0.12)",
                                borderColor: Colors.dark.primary,
                                borderWidth: 2,
                              },
                            ]}
                            onPress={() =>
                              handleSelectAlternative(mode.id, idx)
                            }
                            activeOpacity={0.8}
                          >
                            <View className="flex-row items-center gap-3 flex-1">
                              <View
                                className="w-6 h-6 rounded-full border-2 border-gray-500 items-center justify-center"
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
                                <Text
                                  className="text-white/80 text-[14px] font-bold"
                                  style={[isSelectedAlt && { color: "#fff" }]}
                                >
                                  {t("route", { n: idx + 1 })}
                                </Text>
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
                              </View>
                            </View>
                            <Text
                              className="text-gray-500 text-[15px] font-extrabold"
                              style={[isSelectedAlt && { color: "#fff" }]}
                            >
                              {formatDuration(alt.duration)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            }

            return (
              <TouchableOpacity
                key={mode.id}
                className="flex-row items-center justify-between bg-[#12202a] rounded-[16px] px-4 py-[14px] border border-white/[0.07] min-h-[80px]"
                style={[
                  isSelected && {
                    borderWidth: 2,
                    borderColor: Colors.dark.primary,
                    elevation: 6,
                    shadowColor: Colors.dark.primary,
                    shadowOpacity: 0.25,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                  },
                ]}
                onPress={() => {
                  if (mode.id !== "transit") setSelected(mode.id);
                  else showCommingSoonToast();
                }}
                activeOpacity={0.85}
              >
                <View className="flex-row items-center gap-[14px] flex-1">
                  <View
                    className="w-12 h-12 rounded-[12px] bg-[#1e3040] items-center justify-center"
                    style={[
                      isSelected && { backgroundColor: Colors.dark.primary },
                    ]}
                  >
                    <MaterialIcons
                      name={mode.icon as any}
                      size={28}
                      color={isSelected ? "#fff" : "#90adcb"}
                    />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-white text-[15px] font-bold">
                        {t(`modes.${mode.id}.label`)}
                      </Text>
                      {isSelected && getFastestMode() === mode.id ? (
                        <View className="bg-primary/20 rounded-[4px] px-[6px] py-[2px]">
                          <Text className="text-primary text-[9px] font-extrabold uppercase">
                            {t("fastest")}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      className="text-[#90adcb] text-[13px] mt-[2px]"
                      style={[
                        mode.id === "transit" &&
                          isSelected && { color: Colors.dark.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {t(`modes.${mode.id}.subtitle`)}
                    </Text>
                  </View>
                </View>
                <View className="items-end gap-[2px]">
                  <Text className="text-white text-[15px] font-bold">
                    {mode.id === "transit"
                      ? "—"
                      : modesCalculating[mode.id]
                        ? "…"
                        : routeErrors[mode.id]
                          ? `status: ${routeErrors[mode.id]}`
                          : routeResults[mode.id]
                            ? formatDuration(routeResults[mode.id]!.duration)
                            : "—"}
                  </Text>
                  <Text className="text-[#90adcb] text-[12px]">
                    {mode.id !== "transit" && routeResults[mode.id]
                      ? formatDistance(routeResults[mode.id]!.distance)
                      : ""}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-4 pt-4 bg-transparent"
        style={[{ paddingBottom: insets.bottom + 16 }]}
      >
        {departure ? (
          <>
            <View className="flex-row items-center gap-[6px] mb-[10px] px-1">
              <MaterialIcons name="info-outline" size={18} color="#90adcb" />
              <Text className="text-[#90adcb] text-[12px] flex-1">
                {t("customDepartureInfo")}
              </Text>
            </View>
            <TouchableOpacity
              className="bg-[#1a2f42] rounded-[16px] h-[56px] flex-row items-center justify-center gap-[10px]"
              onPress={handleStartNavigation}
              activeOpacity={0.8}
            >
              <MaterialIcons name="near-me" size={22} color="#90adcb" />
              <Text className="text-[#90adcb] text-[17px] font-extrabold">
                {t("startNavigation")}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            className="bg-primary rounded-[16px] h-[56px] flex-row items-center justify-center gap-[10px] elevation-10 shadow-primary shadow-opacity-40 shadow-radius-[16px] shadow-offset-[0,6]"
            style={{ backgroundColor: Colors.dark.primary }}
            onPress={handleStartNavigation}
            activeOpacity={0.9}
          >
            <Text className="text-white text-[17px] font-extrabold">
              {t("startNavigation")}
            </Text>
            <MaterialIcons name="near-me" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={showPlanner}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowPlanner(false)}
      >
        <GestureHandlerRootView className="flex-1">
          <View
            className="flex-1 bg-[#101922]"
            style={[{ paddingTop: insets.top }]}
          >
            <StatusBar
              hidden
              translucent
              backgroundColor="transparent"
              barStyle="light-content"
            />

            <View
              className="flex-row items-center justify-between px-4 pb-3 border-b"
              style={[{ borderBottomColor: "rgba(255,255,255,0.08)" }]}
            >
              <TouchableOpacity
                onPress={() => setShowPlanner(false)}
                className="w-12 h-12 rounded-full items-center justify-center"
              >
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text className="text-white text-[18px] font-bold flex-1 text-center">
                {t("planner")}
              </Text>
              <View className="w-12 h-12 rounded-full items-center justify-center"></View>
            </View>

            <ScrollView
              contentContainerStyle={{
                padding: 16,
                gap: 10,
                paddingBottom: 20,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={scrollEnabled}
            >
              {waypoints.map((wp, i) => {
                const isFirst = i === 0;
                const isLast = i === waypoints.length - 1;
                const intermediateIndex = waypoints
                  .slice(1, -1)
                  .findIndex((w) => w.id === wp.id);
                const rowLabel = isFirst
                  ? t("departure")
                  : isLast
                    ? t("destinationLabel")
                    : t("step", { n: intermediateIndex + 1 });
                return (
                  <StopRow
                    key={wp.id}
                    stop={wp}
                    index={i}
                    totalCount={waypoints.length}
                    dragIndex={dragIndex}
                    dragAbsY={dragAbsY}
                    isEditing={activeEditIndex === i}
                    editQuery={activeEditIndex === i ? editQuery : ""}
                    autocompleteResults={
                      activeEditIndex === i ? autocompleteResults : []
                    }
                    rowLabel={rowLabel}
                    canRemove={i > 0 && i < waypoints.length - 1}
                    canUseCurrentPosition={!wp.isCurrentPosition}
                    onDragStart={() => setScrollEnabled(false)}
                    onDragFinish={() => setScrollEnabled(true)}
                    onEditActivate={() => handleEditActivate(i)}
                    onSelectCurrentPosition={() =>
                      handleSelectCurrentPosition(i)
                    }
                    onQueryChange={setEditQuery}
                    onSelectResult={(r) => handleSelectResult(i, r)}
                    onRemove={() => removeStop(i)}
                    onDragEnd={reorderStops}
                  />
                );
              })}

              <TouchableOpacity
                className="flex-row items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-white/12 py-[18px] mt-1"
                onPress={addStop}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="add-circle-outline"
                  size={22}
                  color="#90adcb"
                />
                <Text className="text-[#90adcb] text-[15px] font-bold">
                  {t("addStop")}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {!keyboardVisible && (
              <View
                className="bg-[#12202a] rounded-t-[24px] border-t border-white/[0.07] p-4 gap-3"
                style={[{ paddingBottom: insets.bottom + 12 }]}
              >
                <View className="relative">
                  <View className="rounded-[12px] border border-white/10 overflow-hidden">
                    <MapSnapshot pins={mapPins} />
                  </View>
                </View>

                <TouchableOpacity
                  className="bg-primary rounded-[16px] h-[56px] flex-row items-center justify-center gap-[10px] elevation-8 shadow-primary shadow-opacity-35 shadow-radius-[12px] shadow-offset-[0,4]"
                  style={{
                    backgroundColor: Colors.dark.primary,
                    opacity: canSave ? 1 : 0.4,
                  }}
                  onPress={() => {
                    if (!canSave) return;
                    setWaypoints((prev) => [
                      prev[0],
                      ...prev
                        .slice(1, -1)
                        .filter(
                          (w) => w.result !== null || w.isCurrentPosition,
                        ),
                      prev[prev.length - 1],
                    ]);
                    setActiveEditIndex(null);
                    setEditQuery("");
                    setAutocompleteResults([]);
                    setShowPlanner(false);
                  }}
                  activeOpacity={0.9}
                >
                  <MaterialIcons name="check" size={22} color="#fff" />
                  <Text className="text-white text-[17px] font-extrabold">
                    {canSave ? t("save") : t("saveNotEnough")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}
// NativeWind migration complete
