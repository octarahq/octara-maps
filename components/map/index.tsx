import ShadcnMap from "@/components/ShadcnMap";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, Platform, ToastAndroid, View, useWindowDimensions } from "react-native";
import { createTranslator } from "@/i18n";

import { usePosition } from "@/contexts/PositionContext";
import { useRouter } from "expo-router";
import Controls from "./Controls";
import MapCtx, { MapControls } from "./MapContext";
import { useMapLayers } from "./MapLayersContext";

type Props = {
  style?: any;
  children?: React.ReactNode;
  showUserLocation?: boolean;
  showControls?: boolean;
  showUsersPosition?: {
    avatar_url: string;
    latitude: number;
    longitude: number;
  }[];
  goTo?: { lat: number; lng: number };
  initialZoom?: number;
  onStreetViewClick?: (lat: number, lng: number) => void;
  onCenterChange?: (lat: number, lng: number) => void;
  streetViewLocation?: { lat: number; lng: number; heading?: number } | null;
  allowedLayers: "all" | ("traffic" | "transit" | "streetView")[];
  forceLayers?: ("traffic" | "transit" | "streetView")[];
  options?: { enableLongPress?: boolean };
};

export default function MapProvider({
  style,
  children,
  showUserLocation = true,
  showControls = true,
  showUsersPosition = [],
  goTo,
  initialZoom,
  onStreetViewClick,
  onCenterChange,
  streetViewLocation,
  allowedLayers,
  forceLayers,
  options,
}: Props) {
  return (
    <MapProviderContent
      style={style}
      showUserLocation={showUserLocation}
      showControls={showControls}
      showUsersPosition={showUsersPosition}
      goTo={goTo}
      initialZoom={initialZoom}
      onStreetViewClick={onStreetViewClick}
      onCenterChange={onCenterChange}
      streetViewLocation={streetViewLocation}
      allowedLayers={allowedLayers}
      forceLayers={forceLayers}
      options={options}
    >
      {children}
    </MapProviderContent>
  );
}

function MapProviderContent({
  style,
  children,
  showUserLocation = true,
  showControls = true,
  showUsersPosition = [],
  goTo,
  initialZoom,
  onStreetViewClick,
  onCenterChange,
  streetViewLocation,
  allowedLayers,
  forceLayers,
  options,
}: Props) {
  const router = useRouter();
  const layers = useMapLayers();
  const webviewRef = useRef<any>(null);
  const { height: windowHeight } = useWindowDimensions();
  const [height, setHeight] = useState<number | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeight(h);
  }, []);

  const isFullScreen =
    height !== null && Math.abs((height || 0) - windowHeight) < 8;
  const computedInitialZoom = initialZoom ?? (isFullScreen ? 3 : 3);
  const defaultCenterZoom = 17;

  const post = (obj: any) => {
    try {
      webviewRef.current?.postMessage(JSON.stringify(obj));
    } catch {}
  };

  const { position } = usePosition();

  const [followUser, setFollowUser] = useState(true);
  const ignoreMapMove = useRef(false);
  const followRef = useRef(followUser);
  const shouldZoomToDefaultRef = useRef(false);
  const isFlyingRef = useRef(false);
  const hasInitialCentered = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const pendingPositionRef = useRef<typeof position | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);

  const currentZoomRef = useRef(17);

  useEffect(() => {
    if (currentZoom !== null) currentZoomRef.current = currentZoom;
  }, [currentZoom]);

  useEffect(() => {
    followRef.current = followUser;
  }, [followUser]);

  const controls: MapControls = React.useMemo(() => {
    const getMaxZoom = () => (layers.mapType === "terrain" ? 17 : 19);
    return {
      zoomIn: () => {
        const maxZ = getMaxZoom();
        if (currentZoom === null || currentZoom < maxZ)
          post({ type: "zoomBy", delta: 1 });
      },
      zoomOut: () => post({ type: "zoomBy", delta: -1 }),
      setZoom: (zoom: number) => {
        const maxZ = getMaxZoom();
        const target = Math.min(zoom, maxZ);
        post({ type: "setZoom", zoom: target });
      },
      panTo: (lat: number, lng: number) => post({ type: "panTo", lat, lng }),
      zoomTo: (lat: number, lng: number, zoom: number) => {
        const maxZ = getMaxZoom();
        const target = Math.min(zoom, maxZ);
        post({ type: "zoomTo", lat, lng, zoom: target });
      },
      setUserLocation: (lat: number, lng: number) =>
        post({ type: "setUserMarker", lat, lng }),
      followUser,
      toggleFollow: () => {
        setFollowUser(false);
      },
      centerAndFollow: () => {
        shouldZoomToDefaultRef.current = true;
        setFollowUser((f) => {
          if (f && position) {
            ignoreMapMove.current = true;
            isFlyingRef.current = true;
            setTimeout(() => {
              ignoreMapMove.current = false;
              isFlyingRef.current = false;
            }, 1000);
            shouldZoomToDefaultRef.current = false;
            post({
              type: "setUserMarker",
              lat: position.latitude,
              lng: position.longitude,
              center: true,
              offsetY: -40,
              zoom: defaultCenterZoom,
              animate: true,
            });
          }
          return true;
        });
      },
    };
  }, [followUser, position, layers.mapType, currentZoom]);

  const { t: tTraffic } = createTranslator("traffic");

  const handleMapMsg = React.useCallback(async (msg: any) => {
    if (!msg) return;
    if (msg.type === "mapReady") {
      setMapReady(true);
      return;
    }
    if (msg.type === "zoomChanged") {
      setCurrentZoom(msg.zoom);
      return;
    }

    if (msg.type === "error") {
      console.error("WebView Map Error:", msg.message, msg.stack);
      return;
    }

    if (msg.type === "mapMoved") {
      if (!ignoreMapMove.current && followRef.current) {
        setFollowUser(false);
      }
    }

    if (msg.type === "trafficMarkerClicked") {
      const label = tTraffic(`eventTypes.${msg.eventType}`);
      if (Platform.OS === "android") {
        ToastAndroid.show(label, ToastAndroid.SHORT);
      }
      return;
    }

    if (msg.type === "transitStopClicked") {
      router.push({
        pathname: "/stop-details",
        params: {
          id: msg.id,
        },
      } as any);
      return;
    }

    if (msg.type === "streetViewClick") {
      if (onStreetViewClick) {
        onStreetViewClick(msg.lat, msg.lng);
      } else {
        router.push({
          pathname: "/streetview",
          params: { lat: msg.lat, lng: msg.lng },
        } as any);
      }
      return;
    }

    if (msg.type === "centerChanged") {
      if (onCenterChange) {
        onCenterChange(msg.lat, msg.lng);
      }
      return;
    }

    if (msg.type === "mapLongPress") {
      const { lat, lng } = msg;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { "Accept-Language": "fr" } }
        );
        const data = await res.json();
        const name = data.name || data.display_name?.split(",")[0] || "";
        const address = data.display_name || "";
        const osmId = data.osm_id ? String(data.osm_id) : undefined;
        const osmType = data.osm_type
          ? (data.osm_type.charAt(0).toUpperCase() as "N" | "W" | "R")
          : undefined;
        const osmValue = data.type || data.class || undefined;
        router.push({
          pathname: "/(main)/place",
          params: {
            name,
            address,
            lat: String(lat),
            lng: String(lng),
            ...(osmId ? { osm_id: osmId } : {}),
            ...(osmType ? { osm_type: osmType } : {}),
            ...(osmValue ? { osm_value: osmValue } : {}),
          },
        } as any);
      } catch {
        router.push({
          pathname: "/(main)/place",
          params: { lat: String(lat), lng: String(lng) },
        } as any);
      }
      return;
    }
  }, [onStreetViewClick, router, tTraffic]);

  useEffect(() => {
    if (!mapReady) return;
    const theme = layers.darkTheme ? "dark" : "light";

    const providerConfig = (layers.mapProviders as any)[layers.mapType] || {
      type: "default",
    };

    post({
      type: "setBaseLayer",
      layer: layers.mapType,
      theme,
      providerType: providerConfig.type,
      customUrl: providerConfig.customUrl,
    });

    const isAllowed = (layer: "traffic" | "transit" | "streetView") => allowedLayers === "all" || allowedLayers.includes(layer);
    const isForced = (layer: "traffic" | "transit" | "streetView") => forceLayers && forceLayers.includes(layer);

    post({ type: "setPublicTransport", enabled: isForced("transit") ? true : (isAllowed("transit") ? layers.publicTransport : false) });
    post({ type: "setStreetView", enabled: isForced("streetView") ? true : (isAllowed("streetView") ? layers.streetView : false) });
    post({ type: "setTraffic", enabled: isForced("traffic") ? true : (isAllowed("traffic") ? layers.traffic : false) });
  }, [
    mapReady,
    layers.mapType,
    layers.darkTheme,
    layers.publicTransport,
    layers.streetView,
    layers.traffic,
    layers.mapProviders,
    allowedLayers,
    forceLayers,
  ]);

  useEffect(() => {
    if (!mapReady) {
      if (position) pendingPositionRef.current = position;
      return;
    }

    if (goTo) {
      post({ type: "zoomTo", lat: goTo.lat, lng: goTo.lng, zoom: computedInitialZoom });
    }

    if (streetViewLocation) {
      post({ type: "setStreetViewMarker", lat: streetViewLocation.lat, lng: streetViewLocation.lng, heading: streetViewLocation.heading, center: true });
    } else {
      post({ type: "setStreetViewMarker", lat: null, lng: null });
    }

    if (!showUserLocation) {
      post({ type: "clearUserMarker" });
      setFollowUser(false);
    } else {
      const pos = position || pendingPositionRef.current;
      if (pos) {
        pendingPositionRef.current = null;

        let shouldZoom = shouldZoomToDefaultRef.current;
        shouldZoomToDefaultRef.current = false;

        if (!hasInitialCentered.current) {
          shouldZoom = true;
          hasInitialCentered.current = true;
        }

        if (shouldZoom) {
          ignoreMapMove.current = true;
          isFlyingRef.current = true;
          setTimeout(() => {
            ignoreMapMove.current = false;
            isFlyingRef.current = false;
          }, 1000);
        }

        const payload = {
          type: "setUserMarker",
          lat: pos.latitude,
          lng: pos.longitude,
          center: shouldZoom ? true : followUser && !isFlyingRef.current,
          offsetY: followUser ? -40 : 0,
          zoom: shouldZoom ? defaultCenterZoom : undefined,
          animate: true,
        };

        post(payload);
      }
    }

    post({ type: "clearMarkers" });

    if (showUsersPosition && showUsersPosition.length > 0) {
      showUsersPosition.forEach((user) => {
        if (user.latitude && user.longitude) {
          post({
            type: "setUserPositionShareMarker",
            id: user.avatar_url,
            lat: user.latitude,
            lng: user.longitude,
            avatar: user.avatar_url,
          });
        }
      });
    }
  }, [position, mapReady, showUserLocation, followUser, showUsersPosition]);

  return (
    <MapCtx.Provider value={controls}>
      <View className="flex-1 min-h-[100px]" style={style} onLayout={onLayout}>
        <ShadcnMap
          ref={webviewRef}
          initialZoom={initialZoom}
          onMapMessage={handleMapMsg}
          options={options}
        />
        <View className="absolute inset-0" pointerEvents="box-none">
          {children}
          {showControls && <Controls />}
        </View>
      </View>
    </MapCtx.Provider>
  );
}
