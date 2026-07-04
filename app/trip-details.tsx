import { BackIcon } from "@/assets/icons";
import { useUser } from "@/contexts/UserContext";
import ShadcnMap from "@/components/ShadcnMap";
import { Colors } from "@/constants/theme";
import { createTranslator } from "@/i18n";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TripData = {
  trip: {
    TripID: string;
    Route: {
      ShortName: string;
      LongName: string;
      Color: string;
    };
    Headsign: string;
    Shape: {
      Points: string;
    };
    StopTimes: {
      StopID: string;
      Stop: {
        Name: string;
        Lat: number;
        Lon: number;
      };
      StopSequence: number;
      ArrivalTime: number;
    }[];
  };
};

function formatTime(seconds: number): string {
  let h = Math.floor(seconds / 3600) % 24;
  let m = Math.floor((seconds % 3600) / 60);
  if (h < 0) h += 24;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function TripDetailsScreen() {
  const { id, currentStopId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight) + 16;
  const { t } = createTranslator("trip_details");
  const { width: screenWidth } = useWindowDimensions();
  
  const mapRef = useRef<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TripData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [showPrevious, setShowPrevious] = useState(false);

  const mapViewRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const inactivityTimer = useRef<any>(null);

  const { settings } = useUser();
  const mapStyle = settings.mapStyle ?? "satelite";
  const mapLayer = mapStyle === "satelite" ? "satellite" : mapStyle.startsWith("terrain") ? "terrain" : "standard";
  const isDark = mapStyle === "standard_dark" || mapStyle === "terrain_dark";

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const res = await fetch(`https://4021.fr1.orionhost.xyz/data/transit/trip/${id}`);
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
  }, [id, t]);

  const post = (obj: any) => {
    try {
      mapRef.current?.postMessage(JSON.stringify(obj));
    } catch {}
  };

  const centerMap = React.useCallback(() => {
    if (mapViewRef.current && mapRef.current) {
      try {
        const { lat, lng, zoom } = mapViewRef.current;
        mapRef.current.postMessage(JSON.stringify({ type: "zoomTo", lat, lng, zoom, animate: false }));
      } catch {}
    }
  }, []);

  const handleMapMsg = React.useCallback((msg: any) => {
    if (msg?.type === "mapReady") {
      setMapReady(true);
    }
    if (msg?.type === "mapMoved" || msg?.type === "zoomChanged") {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        centerMap();
      }, 5000);
    }
  }, [centerMap]);

  useEffect(() => {
    if (!mapReady) return;
    post({ type: "setBaseLayer", layer: mapLayer, theme: isDark ? "dark" : "light" });
  }, [mapReady, mapLayer, isDark]);

  useEffect(() => {
    if (!mapReady || !data) return;

    post({ type: "setPublicTransport", enabled: false });

    const stopTimes = data.trip.StopTimes || [];
    let startIndex = 0;
    if (currentStopId) {
      const idx = stopTimes.findIndex(st => st.StopID === currentStopId);
      if (idx !== -1) startIndex = idx;
    }

    const relevantStops = stopTimes.slice(startIndex);
    if (relevantStops.length === 0) return;

    let points: number[][] = [];
    try {
      points = JSON.parse(data.trip.Shape.Points);
    } catch (e) {
      console.error("Failed to parse shape points", e);
    }

    if (points.length > 0 && startIndex > 0) {
      const startStop = stopTimes[startIndex];
      let minDistance = Infinity;
      let closestPointIndex = 0;
      
      points.forEach((pt, i) => {
        const d = calculateDistance(startStop.Stop.Lat, startStop.Stop.Lon, pt[0], pt[1]);
        if (d < minDistance) {
          minDistance = d;
          closestPointIndex = i;
        }
      });
      
      points = points.slice(closestPointIndex);
    }


    if (points.length > 0) {
      const routeColor = data.trip.Route.Color.startsWith("#") ? data.trip.Route.Color : `#${data.trip.Route.Color}`;
      post({ type: "clearPolyline" });
      post({
        type: "setPolyline",
        latlngs: points,
        color: routeColor,
        weight: 5,
        opacity: 0.9,
      });

      let minLat = points[0][0], maxLat = points[0][0];
      let minLng = points[0][1], maxLng = points[0][1];
      points.forEach(pt => {
        if (pt[0] < minLat) minLat = pt[0];
        if (pt[0] > maxLat) maxLat = pt[0];
        if (pt[1] < minLng) minLng = pt[1];
        if (pt[1] > maxLng) maxLng = pt[1];
      });

      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      const mapH = 220;
      const mapW = Math.max(screenWidth - 32, 100);
      const padding = 10;
      const effectiveW = mapW - padding * 2;
      const effectiveH = mapH - padding * 2;

      const latSpan = maxLat - minLat;
      const lngSpan = maxLng - minLng;

      let zoom = 12;
      if (latSpan > 0 && lngSpan > 0) {
        const cosCenter = Math.cos(centerLat * Math.PI / 180);
        const zLng = Math.log2((360 * effectiveW) / (256 * lngSpan));
        const zLat = Math.log2((360 * effectiveH * cosCenter) / (256 * latSpan));
        zoom = Math.floor(Math.min(zLng, zLat));
        zoom = Math.max(1, Math.min(zoom, 17));
      }

      mapViewRef.current = { lat: centerLat, lng: centerLng, zoom };
      setTimeout(() => centerMap(), 300);
    }

    post({ type: "clearMarkers" });
    relevantStops.forEach(st => {
      post({
        type: "addMarker",
        lat: st.Stop.Lat,
        lng: st.Stop.Lon,
        circle: true,
        radius: 6,
        color: "#ffffff",
        fillColor: "#000000",
        fillOpacity: 1,
        weight: 2
      });
    });

  }, [mapReady, data, currentStopId]);

  if (loading) {
    return (
      <View className="flex-1 bg-[#101922] justify-center items-center">
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  const stopTimes = data?.trip.StopTimes || [];

  return (
    <View className="flex-1 bg-[#101922]">
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {error ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-[#ff6b6b] text-center">{error}</Text>
        </View>
      ) : (
        <View className="flex-1" style={{ paddingTop: topInset }}>
          <View className="flex-row items-center px-4 mb-4 gap-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-11 h-11 rounded-full items-center justify-center bg-white/10"
            >
              <BackIcon />
            </TouchableOpacity>
            <Text className="text-white text-[20px] font-bold flex-1" numberOfLines={2}>
              {data?.trip.Route.ShortName || data?.trip.Route.LongName} - {data?.trip.Headsign}
            </Text>
          </View>

          <View className="w-full px-4 mb-2" pointerEvents="none">
            <View 
              className="w-full rounded-2xl overflow-hidden border border-white/10 bg-[#12202a] h-[220px]"
            >
              <ShadcnMap
                ref={mapRef}
                initialZoom={4}
                onMapMessage={handleMapMsg}
              />
            </View>
          </View>

          <ScrollView 
            className="flex-1" 
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 10 }}
          >
            <View className="flex-1">
              {(() => {
                let currentIndex = -1;
                if (currentStopId) {
                  currentIndex = stopTimes.findIndex(s => s.StopID === currentStopId);
                }
                const rawColor = data?.trip.Route.Color || "FFFFFF";
                const routeColor = rawColor.startsWith("#") ? rawColor : `#${rawColor}`;

                return (
                <>
                  {currentIndex > 0 && (
                    <TouchableOpacity 
                      onPress={() => setShowPrevious(!showPrevious)}
                      className="flex-row min-h-[40px] items-center mb-2"
                    >
                      <View className="w-[60px]" />
                      <View className="items-center w-[30px] h-full pt-2">
                        <View style={{ backgroundColor: routeColor, opacity: 0.4 }} className="w-[4px] flex-1 rounded-full" />
                      </View>
                      <View className="flex-1 pl-3 justify-center">
                        <Text className="text-[#90adcb] font-medium text-[14px] bg-[#17232f] px-3 py-1.5 rounded-lg self-start">
                          {showPrevious ? "Masquer les arrêts précédents" : `${currentIndex} arrêts précédents`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {stopTimes.map((st, idx) => {
                    const isLast = idx === stopTimes.length - 1;
                    const isCurrent = currentStopId && st.StopID === currentStopId;
                    const isPast = currentIndex !== -1 && idx < currentIndex;
                    
                    if (isPast && !showPrevious) return null;
                    
                    const rowOpacity = isPast ? 0.4 : 1;

                    return (
                      <TouchableOpacity
                        key={st.StopID + idx}
                        onPress={() => router.push({ pathname: "/stop-details", params: { id: st.StopID } })}
                        className="flex-row min-h-[60px]"
                        style={{ opacity: rowOpacity }}
                      >
                        <View className="w-[60px] items-center justify-start pt-1">
                          <Text className={`font-bold text-[14px] ${isCurrent ? 'text-white' : 'text-[#90adcb]'}`}>
                            {formatTime(st.ArrivalTime)}
                          </Text>
                        </View>
                        
                        <View className="items-center w-[30px]">
                          <View 
                            style={{ 
                              borderColor: routeColor, 
                              backgroundColor: isCurrent ? '#101922' : routeColor 
                            }}
                            className={`rounded-full border-[3px] ${isCurrent ? 'w-5 h-5' : 'w-4 h-4'}`} 
                          />
                          {!isLast && (
                            <View 
                              style={{ backgroundColor: routeColor }} 
                              className="w-[4px] flex-1 my-1 rounded-full" 
                            />
                          )}
                        </View>
                        
                        <View className="flex-1 pb-6 pt-1 pl-3 justify-start">
                          <Text 
                            className={`text-[16px] ${isCurrent ? 'font-bold text-white' : 'font-medium text-white'}`}
                            numberOfLines={2}
                          >
                            {st.Stop.Name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              );
            })()}
          </View>
        </ScrollView>
        </View>
      )}
    </View>
  );
}
