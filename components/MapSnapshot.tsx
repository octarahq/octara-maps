import ShadcnMap from "@/components/ShadcnMap";
import { MapLayersContext } from "@/components/map/MapLayersContext";
import React, { useRef } from "react";
import { View } from "react-native";

import {
  departureSvg,
  destinationSvg,
  waypointSvg,
} from "@/assets/icons/svgStrings";
import { cn } from "@/utils/cn";

export type WaypointPin = {
  lat: number;
  lng: number;
  type: "departure" | "waypoint" | "destination";
  stepNumber?: number;
};

interface Props {
  pins?: WaypointPin[];
  routeCoords?: { latitude: number; longitude: number }[];
  routeSections?: { coords: { latitude: number; longitude: number }[]; color?: string }[];
  lat?: number;
  lng?: number;
  heading?: number;
  zoom?: number;
  interactive?: boolean;
  style?: any;
  className?: string;
  onMapReady?: () => void;
  onMapMoved?: () => void;
}

export interface MapSnapshotRef {
  zoomTo: (lat: number, lng: number, zoom?: number) => void;
  panTo: (lat: number, lng: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

function MapSnapshotInnerFunc({
  pins,
  routeCoords,
  routeSections,
  lat,
  lng,
  heading,
  zoom = 11,
  interactive = false,
  style,
  className,
  onMapReady,
  onMapMoved,
}: Props, fRef: React.Ref<MapSnapshotRef>) {
  const ref = useRef<any>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const ctx = React.useContext(MapLayersContext);
  const layers = React.useMemo(
    () =>
      ctx ??
      ({
        mapType: "standard",
        darkTheme: false,
      } as any),
    [ctx],
  );

  const post = (obj: any) => {
    try {
      ref.current?.postMessage(JSON.stringify(obj));
    } catch {}
  };

  React.useImperativeHandle(fRef, () => ({
    zoomTo: (lat, lng, z = 15) => post({ type: "zoomTo", lat, lng, zoom: z }),
    panTo: (lat, lng) => post({ type: "panTo", lat, lng }),
    zoomIn: () => post({ type: "zoomBy", delta: 1 }),
    zoomOut: () => post({ type: "zoomBy", delta: -1 }),
  }), []);

  const lastKey = React.useRef("");
  const lastLayer = React.useRef("");

  React.useEffect(() => {
    if (!mapReady) {
      lastKey.current = "";
      lastLayer.current = "";
    }
  }, [mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;

    const layerKey = `${layers?.mapType ?? "standard"}-${layers?.darkTheme ? "dark" : "light"}`;
    if (layerKey !== lastLayer.current) {
      lastLayer.current = layerKey;
      const theme = layers?.darkTheme ? "dark" : "light";
      post({
        type: "setBaseLayer",
        layer: layers?.mapType ?? "standard",
        theme,
      });
    }

    const hasPins = pins && pins.length > 0;
    const hasCoords = routeCoords && routeCoords.length >= 2;
    const hasSections = routeSections && routeSections.length > 0;

    if (hasPins || hasCoords || hasSections) {
      const routeFingerprint = hasCoords
          ? `${routeCoords[0].latitude},${routeCoords[0].longitude}:${routeCoords[routeCoords.length - 1].latitude},${routeCoords[routeCoords.length - 1].longitude}:${routeCoords.length}`
          : "0";
      const sectionsFingerprint = hasSections 
        ? routeSections.map(s => `${s.color || 'none'}:${s.coords.length}`).join('|') 
        : "0";
      const key = JSON.stringify(pins || []) + routeFingerprint + sectionsFingerprint;
      
      if (key !== lastKey.current) {
        lastKey.current = key;

        post({ type: "clearMarkers" });
        post({ type: "clearPolyline" });
        post({ type: "clearOverlayPolylines" });

        if (hasSections) {
          routeSections.forEach(sec => {
            post({
              type: "addOverlayPolyline",
              latlngs: sec.coords.map((c) => [c.latitude, c.longitude]),
              color: sec.color ? `#${sec.color.replace(/^#/, '')}` : "#0d7ff2",
              weight: 3,
              opacity: 0.9,
            });
          });
        } else if (hasCoords) {
          post({
            type: "setPolyline",
            latlngs: routeCoords.map((c) => [c.latitude, c.longitude]),
            color: "#0d7ff2",
            weight: 2,
            opacity: 0.85,
          });
        }

        const valid = (pins || []).filter((p) => p.lat && p.lng);
        if (valid.length > 0) {
          if (!hasSections && !hasCoords && valid.length >= 2) {
            post({
              type: "setPolyline",
              latlngs: valid.map((p) => [p.lat, p.lng]),
              color: "#0d7ff2",
              weight: 2.5,
              opacity: 0.8,
            });
          }

          let stepIdx = 1;
          valid.forEach((p) => {
            if (p.type === "departure") {
              post({
                type: "addMarker",
                lat: p.lat,
                lng: p.lng,
                html: departureSvg(),
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              });
            } else if (p.type === "destination") {
              post({
                type: "addMarker",
                lat: p.lat,
                lng: p.lng,
                html: destinationSvg(),
                iconSize: [22, 22],
                iconAnchor: [4, 22],
              });
            } else {
              const n = p.stepNumber ?? stepIdx++;
              post({
                type: "addMarker",
                lat: p.lat,
                lng: p.lng,
                html: waypointSvg(n),
                iconSize: [24, 30],
                iconAnchor: [12, 30],
              });
            }
          });
        }

        const fitPoints: { lat: number; lng: number }[] = [];
        if (hasCoords) {
          fitPoints.push(...routeCoords.map((c) => ({ lat: c.latitude, lng: c.longitude })));
        } else if (hasSections) {
          routeSections.forEach((sec) =>
            fitPoints.push(...sec.coords.map((c) => ({ lat: c.latitude, lng: c.longitude })))
          );
        } else {
          fitPoints.push(...valid);
        }

        if (fitPoints.length >= 2) {
          const lats = fitPoints.map((p) => p.lat);
          const lngs = fitPoints.map((p) => p.lng);
          post({
            type: "fitBounds",
            bounds: [
              [Math.min(...lats), Math.min(...lngs)],
              [Math.max(...lats), Math.max(...lngs)],
            ],
            padding: interactive ? [32, 32] : [8, 8],
          });
        } else if (fitPoints.length === 1) {
          post({
            type: "zoomTo",
            lat: fitPoints[0].lat,
            lng: fitPoints[0].lng,
            zoom: 13,
            animate: false,
          });
        }
      }
    } else {
      if (lat != null && lng != null) {
        post({ type: "zoomTo", lat, lng, zoom, animate: false });
      }
    }

    if (lat != null && lng != null) {
      post({ type: "setUserMarker", lat, lng, heading, icon: "circle" });
    }
  }, [mapReady, pins, routeCoords, routeSections, lat, lng, heading, zoom, layers, interactive]);

  const handleMapMsg = React.useCallback((msg: any) => {
    if (msg?.type === "mapReady") {
      setMapReady(true);
      if (onMapReady) onMapReady();
    } else if (msg?.type === "mapMoved") {
      if (onMapMoved) onMapMoved();
    } else if (msg?.type === "error") {
      console.error("WebView MapSnapshot Error:", msg.message, msg.stack);
    }
  }, [onMapReady, onMapMoved]);

  return (
    <View className={cn("overflow-hidden rounded-2xl relative", className)} style={[style, { opacity: 0.99 }]}>
      <ShadcnMap
        ref={ref}
        initialZoom={pins && pins.length > 0 ? 2 : zoom}
        onMapMessage={handleMapMsg}
      />
      {!interactive && (
        <View className="absolute inset-0 z-50 bg-transparent" />
      )}
    </View>
  );
}

const MapSnapshotInner = React.forwardRef(MapSnapshotInnerFunc);
const MapSnapshot = React.memo(MapSnapshotInner);
export default MapSnapshot;
