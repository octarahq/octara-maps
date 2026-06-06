import ShadcnMap from "@/components/ShadcnMap";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  View,
  useWindowDimensions,
} from "react-native";

import { usePosition } from "@/contexts/PositionContext";
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
};

export default function MapProvider({
  style,
  children,
  showUserLocation = true,
  showControls = true,
  showUsersPosition = [],
  goTo,
}: Props) {
  return (
    <MapProviderContent
      style={style}
      showUserLocation={showUserLocation}
      showControls={showControls}
      showUsersPosition={showUsersPosition}
      goTo={goTo}
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
}: Props) {
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
  const initialZoom = isFullScreen ? 3 : 3;
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
        setFollowUser((f) => !f);
      },
      centerAndFollow: () => {
        setFollowUser(true);

        if (position) {
          ignoreMapMove.current = true;
          setTimeout(() => {
            ignoreMapMove.current = false;
          }, 1000);
          post({
            type: "setUserMarker",
            lat: position.latitude,
            lng: position.longitude,
            center: true,
            offsetY: -40,
            zoom: defaultCenterZoom,
            animate: false,
          });
        }
      },
    };
  }, [followUser, position, layers.mapType, currentZoom]);

  const handleMapMsg = React.useCallback((msg: any) => {
    if (!msg) return;
    if (msg.type === "mapReady") {
      setMapReady(true);
      return;
    }
    if (msg.type === "zoomChanged") {
      setCurrentZoom(msg.zoom);
      return;
    }

    if (msg.type === "mapMoved") {
      if (followRef.current) {
        setFollowUser(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const theme = layers.darkTheme ? "dark" : "light";
    post({ type: "setBaseLayer", layer: layers.mapType, theme });
  }, [mapReady, layers.mapType, layers.darkTheme]);

  useEffect(() => {
    if (!mapReady) {
      if (position) pendingPositionRef.current = position;
      return;
    }

    if (goTo) {
      post({ type: "panTo", lat: goTo.lat, lng: goTo.lng });
    }

    if (!showUserLocation) {
      post({ type: "clearUserMarker" });
      setFollowUser(false);
    } else {
      const pos = position || pendingPositionRef.current;
      if (pos) {
        pendingPositionRef.current = null;
        post({
          type: "setUserMarker",
          lat: pos.latitude,
          lng: pos.longitude,
          center: followUser,
          offsetY: followUser ? -40 : 0,
          zoom: followUser ? defaultCenterZoom : undefined,
          animate: false,
        });
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
        />
        <View className="absolute inset-0" pointerEvents="box-none">
          {children}
          {showControls && <Controls />}
        </View>
      </View>
    </MapCtx.Provider>
  );
}

