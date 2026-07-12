import MapProvider from "@/components/map";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

interface Hotspot {
  yaw: number;
  pitch: number;
  href: string;
}

interface PicInfo {
  imageUrl: string;
  lat: number;
  lng: number;
  azimuth: number;
  hotspots: Hotspot[];
}

function gpsBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * R) * Math.cos(lat2 * R);
  const x =
    Math.cos(lat1 * R) * Math.sin(lat2 * R) -
    Math.sin(lat1 * R) * Math.cos(lat2 * R) * Math.cos((lng2 - lng1) * R);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

async function fetchPicInfoFromHref(href: string): Promise<PicInfo | null> {
  try {
    const res = await fetch(href, {
      headers: { Accept: "application/geo+json" },
    });
    if (!res.ok) return null;
    const feature = await res.json();

    const imageUrl = feature.assets?.sd?.href || feature.assets?.hd?.href;
    if (!imageUrl) return null;

    const [lng, lat] = feature.geometry.coordinates as [number, number];
    const azimuth: number = feature.properties?.["view:azimuth"] ?? 0;

    const hotspots: Hotspot[] = (feature.links ?? [])
      .filter((l: any) => (l.rel === "prev" || l.rel === "next") && l.geometry)
      .map((l: any) => {
        const [nLng, nLat] = l.geometry.coordinates as [number, number];
        const bearing = gpsBearing(lat, lng, nLat, nLng);
        const yaw = ((((bearing - azimuth + 360) % 360) + 180) % 360) - 180;
        return { yaw, pitch: -20, href: l.href };
      });

    return { imageUrl, lat, lng, azimuth, hotspots };
  } catch {
    return null;
  }
}

async function findNearestPicInfo(
  picLat: number,
  picLng: number,
): Promise<PicInfo | null> {
  try {
    const delta = 0.002;
    const bbox = `${picLng - delta},${picLat - delta},${picLng + delta},${picLat + delta}`;
    const res = await fetch(`https://panoramax.ign.fr/api/search?bbox=${bbox}`);
    const data = await res.json();
    if (!data.features?.length) return null;

    const feature = data.features[0];
    const selfLink = feature.links?.find((l: any) => l.rel === "self");
    if (selfLink) return fetchPicInfoFromHref(selfLink.href);

    const imageUrl = feature.assets?.sd?.href || feature.assets?.hd?.href;
    if (!imageUrl) return null;
    const [lng, lat] = feature.geometry.coordinates as [number, number];
    return { imageUrl, lat, lng, azimuth: 0, hotspots: [] };
  } catch {
    return null;
  }
}

function buildViewerHtml(picInfo: PicInfo): string {
  const hotspotsJson = JSON.stringify(picInfo.hotspots);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
  <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
  <style>
    body,html{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#111}
    #panorama{width:100%;height:100%}
    .pnx-arrow {
      width:0; height:0;
      border-left:18px solid transparent;
      border-right:18px solid transparent;
      border-bottom:32px solid rgba(255,255,255,0.88);
      cursor:pointer;
      filter:drop-shadow(0 2px 6px rgba(0,0,0,0.7));
      transition:transform .15s,border-bottom-color .15s;
    }
    .pnx-arrow:hover{border-bottom-color:#00aeff;transform:scale(1.2)}
    .pnlm-about-msg,.pnlm-load-button p{display:none!important}
    
    .pnlm-hotspot-base {
      background-color: transparent !important;
      -webkit-tap-highlight-color: transparent !important;
      outline: none !important;
    }
    .pnlm-hotspot-base:hover,
    .pnlm-hotspot-base:active,
    .pnlm-hotspot-base:focus {
      background-color: transparent !important;
      outline: none !important;
    }
    * { -webkit-tap-highlight-color: transparent; }
  </style>
</head>
<body>
  <div id="panorama"></div>
  <script>
    var viewer = null;

    function postToRN(obj) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e){}
    }

    function makeHotspots(hotspots) {
      return hotspots.map(function(h) {
        return {
          pitch: h.pitch,
          yaw: h.yaw,
          type: 'custom',
          createTooltipFunc: (function(hotspot) {
            return function(div) {
              div.style.cssText = 'cursor:pointer;border:none;padding:20px;margin:-20px;perspective:300px;perspective-origin:center center;';
              div.style.setProperty('background-color', 'transparent', 'important');
              div.style.setProperty('background', 'transparent', 'important');
              div.style.setProperty('-webkit-tap-highlight-color', 'transparent', 'important');
              new MutationObserver(function() {
                div.style.setProperty('background-color', 'transparent', 'important');
              }).observe(div, { attributes: true, attributeFilter: ['style'] });

              var svgNS = 'http://www.w3.org/2000/svg';
              var svg = document.createElementNS(svgNS, 'svg');
              svg.setAttribute('width', '36');
              svg.setAttribute('height', '48');
              svg.setAttribute('viewBox', '0 0 36 48');
              svg.style.cssText = [
                'display:block',
                'overflow:visible',
                'filter:drop-shadow(0 3px 8px rgba(0,0,0,0.75))',
                'transform:rotateY(' + hotspot.yaw + 'deg) rotateX(65deg)',
                'transform-style:preserve-3d',
                'transform-origin:center 80%',
                'transition:filter .15s',
              ].join(';');

              var body = document.createElementNS(svgNS, 'polygon');
              body.setAttribute('points', '18,2 33,38 18,28 3,38');
              body.setAttribute('fill', 'rgba(255,255,255,0.92)');
              svg.appendChild(body);

              var base = document.createElementNS(svgNS, 'rect');
              base.setAttribute('x', '8');
              base.setAttribute('y', '39');
              base.setAttribute('width', '20');
              base.setAttribute('height', '6');
              base.setAttribute('rx', '3');
              base.setAttribute('fill', 'rgba(255,255,255,0.92)');
              svg.appendChild(base);

              div.appendChild(svg);

              div.addEventListener('mouseover', function() {
                svg.querySelectorAll('polygon,rect').forEach(function(el) {
                  el.setAttribute('fill', '#00aeff');
                });
              });
              div.addEventListener('mouseout', function() {
                svg.querySelectorAll('polygon,rect').forEach(function(el) {
                  el.setAttribute('fill', 'rgba(255,255,255,0.90)');
                });
              });
              div.addEventListener('click', function(e) {
                e.stopPropagation();
                postToRN({ type: 'navigateTo', href: hotspot.href });
              });
            };
          })(h)
        };
      });
    }

    function initViewer(imageUrl, hotspots) {
      if (viewer) { try { viewer.destroy(); } catch(e){} }
      viewer = pannellum.viewer('panorama', {
        type: 'equirectangular',
        panorama: imageUrl,
        autoLoad: true,
        showZoomCtrl: false,
        showFullscreenCtrl: false,
        compass: false,
        hfov: 100,
        hotSpots: makeHotspots(hotspots)
      });
    }

    initViewer('${picInfo.imageUrl}', ${hotspotsJson});

    window.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'setScene') {
          initViewer(data.imageUrl, data.hotspots);
        }
      } catch(e){}
    });
    document.addEventListener('message', function(e) {
      window.dispatchEvent(new MessageEvent('message', { data: e.data }));
    });

    var lastYaw = null;
    setInterval(function() {
      if (viewer && typeof viewer.getYaw === 'function') {
        var yaw = viewer.getYaw();
        if (yaw !== lastYaw) {
          lastYaw = yaw;
          postToRN({ type: 'viewChange', yaw: yaw });
        }
      }
    }, 100);
  </script>
</body>
</html>`;
}

export default function StreetViewScreen() {
  const { lat, lng } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const initialLat = parseFloat(lat as string);
  const initialLng = parseFloat(lng as string);

  const [location, setLocation] = useState({
    lat: initialLat,
    lng: initialLng,
  });
  const [picInfo, setPicInfo] = useState<PicInfo | null>(null);
  const picInfoRef = useRef<PicInfo | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [viewerHtml, setViewerHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const webviewRef = useRef<WebView>(null);
  const viewerMounted = useRef(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback(
    async (fetcher: () => Promise<PicInfo | null>) => {
      loadingTimerRef.current = setTimeout(() => setLoading(true), 200);

      const info = await fetcher();

      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setLoading(false);

      if (!info) return;
      setPicInfo(info);
      picInfoRef.current = info;
      setHeading(info.azimuth);
      setLocation({ lat: info.lat, lng: info.lng });

      if (!viewerMounted.current) {
        setViewerHtml(buildViewerHtml(info));
        viewerMounted.current = true;
      } else {
        webviewRef.current?.postMessage(
          JSON.stringify({
            type: "setScene",
            imageUrl: info.imageUrl,
            hotspots: info.hotspots,
          }),
        );
      }
    },
    [],
  );

  useEffect(() => {
    navigate(() => findNearestPicInfo(initialLat, initialLng));
  }, []);

  const onWebViewMessage = useCallback(
    (e: any) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data);
        if (msg.type === "navigateTo") {
          navigate(() => fetchPicInfoFromHref(msg.href));
        } else if (msg.type === "viewChange" && picInfoRef.current) {
          setHeading((picInfoRef.current.azimuth + msg.yaw + 360) % 360);
        }
      } catch {}
    },
    [navigate],
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 10 }]}
        onPress={() => router.back()}
      >
        <MaterialIcons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.topHalf}>
        {viewerHtml ? (
          <>
            <WebView
              ref={webviewRef}
              source={{ html: viewerHtml, baseUrl: "https://panoramax.ign.fr" }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mixedContentMode="always"
              onMessage={onWebViewMessage}
            />
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#00aeff" />
              </View>
            )}
          </>
        ) : (
          <View style={styles.placeholder}>
            {loading ? (
              <ActivityIndicator size="large" color="#00aeff" />
            ) : (
              <MaterialIcons name="360" size={48} color="#444" />
            )}
          </View>
        )}
      </View>

      <View style={styles.bottomHalf}>
        <MapProvider
          allowedLayers="all"
          showControls={false}
          showUserLocation={false}
          initialZoom={15}
          goTo={{ lat: location.lat, lng: location.lng }}
          streetViewLocation={{ lat: location.lat, lng: location.lng, heading }}
          onStreetViewClick={(newLat, newLng) => {
            setLocation({ lat: newLat, lng: newLng });
            navigate(() => findNearestPicInfo(newLat, newLng));
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  topHalf: { flex: 1 },
  bottomHalf: { flex: 1, borderTopWidth: 2, borderColor: "#222" },
  webview: { flex: 1, backgroundColor: "#111" },
  placeholder: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 30,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
