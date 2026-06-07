import { addressSvg } from "@/assets/icons/svgStrings";
import React from "react";
import { Platform, View } from "react-native";
import { WebView, WebViewProps } from "react-native-webview";

const WebWebView = React.forwardRef<any, WebViewProps>(
  ({ source, onMessage, style }, ref) => {
    const iframeRef = React.useRef<HTMLIFrameElement>(null);

    React.useImperativeHandle(ref, () => ({
      postMessage: (data: string) => {
        iframeRef.current?.contentWindow?.postMessage(data, "*");
      },
    }));

    React.useEffect(() => {
      const handler = (event: MessageEvent) => {
        if (typeof event.data === "string" && event.data.includes("type")) {
          onMessage?.({
            nativeEvent: { data: event.data },
          } as any);
        }
      };
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    }, [onMessage]);

    return (
      <iframe
        ref={iframeRef}
        style={{
          border: "none",
          width: "100%",
          height: "100%",
          ...(style as any),
        }}
        srcDoc={(source as any).html}
      />
    );
  },
);

WebWebView.displayName = "WebWebView";

type Props = {
  initialZoom?: number;
  onMapMessage?: (msg: any) => void;
};

const ShadcnMap = React.forwardRef<any, Props>(
  ({ initialZoom = 2, onMapMessage }, ref) => {
    const addressSvgString = addressSvg("#0d7ff2");

    const html: string = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        html, body { height:100%; margin:0; padding:0; background:#000; overflow:hidden; }

        .custom-pin {
          position: relative;
          width: 40px;
          height: 50px;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 40px;
        }

        .pin-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid #0d7ff2;
          background: #1a2533;
          overflow: hidden;
          z-index: 2;
        }

        .pin-avatar {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .pin-tip {
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 10px solid #0d7ff2;
          margin-top: -2px;
          z-index: 1;
        }

        #mapViewport {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #000;
        }
        #mapRotate {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 170vmax;
          height: 170vmax;
          transform: translate(-50%, -50%);
          transform-origin: 50% 50%;
          will-change: transform;
        }
          
        #map { width:100%; height:100%; }
        .leaflet-container, .leaflet-pane, .leaflet-tile { background: #000 !important; }
        .leaflet-control-attribution { display: none !important; }
      </style>
    </head>
    <body>
      <div id="mapViewport">
        <div id="mapRotate">
          <div id="map"></div>
        </div>
      </div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const map = L.map('map', { 
          zoomControl: false, 
          worldCopyJump: true, 
          maxBoundsViscosity: 1, 
          attributionControl: false 
        }).setView([0,0], ${initialZoom});

        var baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
          maxZoom: 19,
          minZoom: ${initialZoom},
          detectRetina: true,
          tileSize: 512,
          zoomOffset: -1,
        }).addTo(map);

        const south = -85;
        const north = 85;
        map.setMaxBounds([[south, -360], [north, 360]]);
        
        window.addEventListener('resize', function(){ map.invalidateSize(); });
        setTimeout(()=>map.invalidateSize(), 200);

    function postToApp(data) {
      const msg = typeof data === 'string' ? data : JSON.stringify(data);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      } else {
        window.parent.postMessage(msg, '*');
      }
    }

    map.whenReady(function(){
      try { postToApp({ type: 'mapReady' }); } catch(e) {}
      try { postToApp({ type: 'zoomChanged', zoom: map.getZoom() }); } catch(e) {}
    });

    function sendMove(e){
      postToApp({type:'mapMoved', cause: e.type });
    }

    map.on('dragstart', sendMove);       
    map.on('zoomend', function(){ try { postToApp({ type: 'zoomChanged', zoom: map.getZoom() }); } catch(e) {} });
    var currentBearing = 0;
        var targetBearing = 0;
        var bearingRaf = null;
        var userMarker = null;
        var markers = [];
        var routePolyline = null;
        var overlayPolylines = [];

        function normalizeBearing(angle) {
          var a = Number(angle) || 0;
          a = ((a % 360) + 360) % 360;
          return a;
        }

        function shortestDelta(fromDeg, toDeg) {
          var d = toDeg - fromDeg;
          while (d > 180) d -= 360;
          while (d < -180) d += 360;
          return d;
        }

        function applyBearingTransform(angle) {
          var rotateEl = document.getElementById('mapRotate');
          if (!rotateEl) return;

          rotateEl.style.transition = 'none';
          rotateEl.style.transform = 'translate(-50%, -50%) rotate(' + (-angle) + 'deg)';
        }

        function animateBearingStep() {
          var delta = shortestDelta(currentBearing, targetBearing);

          if (Math.abs(delta) < 0.2) {
            currentBearing = targetBearing;
            applyBearingTransform(currentBearing);
            bearingRaf = null;
            return;
          }

          var easedStep = delta * 0.18;
          var clampedStep = Math.max(-10, Math.min(10, easedStep));
          currentBearing = currentBearing + clampedStep;

          applyBearingTransform(currentBearing);
          bearingRaf = requestAnimationFrame(animateBearingStep);
        }

        function applyBearing(nextBearing) {
          targetBearing = normalizeBearing(nextBearing);

          if (bearingRaf == null) {
            bearingRaf = requestAnimationFrame(animateBearingStep);
          }
        }

        function handleMessage(msg) {
          try {
            const m = JSON.parse(msg);
            
            if (m.type === 'zoomTo') {
              if (m.animate === false) {
                map.setView([m.lat || 0, m.lng || 0], m.zoom);
              } else {
                map.flyTo([m.lat || 0, m.lng || 0], m.zoom, { duration: m.duration || 0.6 });
              }
            }
            setTimeout(()=>map.invalidateSize(),100);
            if (m.type === 'setZoom') { map.setZoom(m.zoom, { animate: m.animate !== false }); }
            if (m.type === 'zoomBy') { map.setZoom(map.getZoom() + (m.delta || 0), { animate: m.animate !== false }); }
            if (m.type === 'panTo') {
              if (m.zoom != null) {
                map.setView([m.lat, m.lng], m.zoom, { animate: m.animate !== false, duration: m.duration || 0.6 });
              } else {
                map.panTo([m.lat, m.lng], { animate: m.animate !== false, duration: m.duration || 0.6 });
              }
              if (m.bearing != null) {
                applyBearing(m.bearing);
              }
            }
            if (m.type === 'setTileBuffer') {
              if (baseLayer && typeof m.buffer === 'number') {
                baseLayer.options.keepBuffer = m.buffer;
                if (map && map.options) {
                  map.options.keepBuffer = m.buffer;
                }
              }
            }
            if (m.type === 'setBearing') {
              applyBearing(m.bearing || 0);
            }
            if (m.type === 'fitBounds') {
              map.invalidateSize();
              setTimeout(function(){ map.fitBounds(m.bounds, { animate: false, padding: m.padding || [24, 24] }); }, 120);
            }
            if (m.type === 'setUserMarker') {
              const lat = m.lat; const lng = m.lng;
              const iconType = m.icon || null;
              
              if (userMarker) {
                map.removeLayer(userMarker);
                userMarker = null;
              }
              if (iconType === 'address') {
                const svg = ${JSON.stringify(addressSvgString)};
                const myIcon = L.divIcon({
                  className: '',
                  html: svg,
                  iconSize: [24,24],
                  iconAnchor: [12,24]
                });
                userMarker = L.marker([lat, lng], { icon: myIcon }).addTo(map);
              } else {
                userMarker = L.circleMarker([lat, lng], { radius: 8, color: '#fff', fillColor: '#0d7ff2', fillOpacity: 1, weight: 2 }).addTo(map);
              }
              userMarker.bringToFront();

              if (m.center) {
                const point = map.project([lat, lng]);
                point.y += (m.offsetY || 0);
                const target = map.unproject(point);
                map.setView(target, m.zoom || map.getZoom(), { animate: m.animate !== false });
              }
            }
            if (m.type === 'setUserPositionShareMarker') {
              const lat = m.lat; 
              const lng = m.lng;
              const markerId = m.id || 'target-user';

              markers.forEach(mk => { if(mk.options.id === markerId) map.removeLayer(mk); });
              markers = markers.filter(mk => mk.options.id !== markerId);

              const customIcon = L.divIcon({
                  className: 'custom-pin-container',
                  html: \`
                      <div class="custom-pin">
                          <div class="pin-circle" style="background-color: white;">
                              <img src="\${m.avatar}" 
                                  class="pin-avatar" 
                                  onload="this.style.opacity=1" 
                                  onerror="this.parentElement.style.backgroundColor='#0d7ff2'"
                                  style="opacity:0; width:40px; height:40px; border-radius:50%;" />
                          </div>
                          <div class="pin-tip"></div>
                      </div>
                  \`,
                  iconSize: [40, 50],
                  iconAnchor: [20, 50]
              });

              const marker = L.marker([lat, lng], { 
                  icon: customIcon, 
                  id: markerId,
                  zIndexOffset: 1000 
              }).addTo(map);

              markers.push(marker);
              
              if (m.center) {
                  map.setView([lat, lng], m.zoom || map.getZoom(), { animate: true });
              }
          } 
            if (m.type === 'clearUserMarker') {
              if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
            }
            
            if (m.type === 'clearMarkers') {
              markers.forEach(function(mk){ map.removeLayer(mk); });
              markers = [];
            }
            if (m.type === 'addMarker') {
              let mk;
              if (m.circle) {
                mk = L.circle([m.lat, m.lng], {
                  radius: m.radius || 6,
                  color: m.color || '#0d7ff2',
                  fillColor: m.fillColor || (m.color || '#0d7ff2'),
                  fillOpacity: m.fillOpacity != null ? m.fillOpacity : 1,
                  weight: m.weight || 2,
                }).addTo(map);
              } else {
                var mIcon = L.divIcon({ className: '', html: m.html, iconSize: m.iconSize || [28,36], iconAnchor: m.iconAnchor || [14,36] });
                mk = L.marker([m.lat, m.lng], { icon: mIcon }).addTo(map);
              }
              markers.push(mk);
            }
            if (m.type === 'clearPolyline') {
              if (routePolyline) { map.removeLayer(routePolyline); routePolyline = null; }
            }
            if (m.type === 'setPolyline') {
              if (routePolyline) { map.removeLayer(routePolyline); routePolyline = null; }
              if (m.latlngs && m.latlngs.length > 1) {
                var polylineOpts = { color: m.color || '#0d7ff2', weight: m.weight || 2.5, opacity: m.opacity || 0.85 };
                if (m.dashArray) polylineOpts.dashArray = m.dashArray;
                routePolyline = L.polyline(m.latlngs, polylineOpts).addTo(map);
              }
            }
            if (m.type === 'addOverlayPolyline') {
              if (m.latlngs && m.latlngs.length > 1) {
                var polylineOpts = { color: m.color || '#fff', weight: m.weight || 4, opacity: m.opacity || 1 };
                var overlay = L.polyline(m.latlngs, polylineOpts).addTo(map);
                overlayPolylines.push(overlay);
                
                if (m.arrow) {
                  var p1 = L.latLng(m.latlngs[m.latlngs.length - 2]);
                  var p2 = L.latLng(m.latlngs[m.latlngs.length - 1]);
                  
                  var pixelP1 = map.latLngToLayerPoint(p1);
                  var pixelP2 = map.latLngToLayerPoint(p2);
                  
                  var dx = pixelP2.x - pixelP1.x;
                  var dy = pixelP2.y - pixelP1.y;
                  var angle = Math.atan2(dy, dx);
                  
                  var len = 8;
                  
                  var a1 = angle + Math.PI * 0.85; 
                  var a2 = angle - Math.PI * 0.85;
                  
                  var tip1 = map.layerPointToLatLng([pixelP2.x + Math.cos(a1) * len, pixelP2.y + Math.sin(a1) * len]);
                  var tip2 = map.layerPointToLatLng([pixelP2.x + Math.cos(a2) * len, pixelP2.y + Math.sin(a2) * len]);
                  
                  var triangleOpts = { stroke: true, color: m.color || '#fff', weight: 3, lineJoin: 'round', lineCap: 'round', fill: true, fillColor: m.color || '#fff', fillOpacity: 1 };
                  var arrowHead = L.polygon([tip1, p2, tip2], triangleOpts).addTo(map);
                  overlayPolylines.push(arrowHead);
                }
              }
            }
            if (m.type === 'clearOverlayPolylines') {
              overlayPolylines.forEach(function(p){ map.removeLayer(p); });
              overlayPolylines = [];
            }
            if (m.type === 'setBaseLayer') {
              var layer = m.layer || 'standard';
              var theme = m.theme || 'dark';
              
              if (baseLayer) { map.removeLayer(baseLayer); }
              setTimeout(()=>map.invalidateSize(),100);
              if (layer === 'standard') {
                var url = 'https://{s}.basemaps.cartocdn.com/' + theme + '_all/{z}/{x}/{y}.png';
                baseLayer = L.tileLayer(url, { maxZoom: 19, minZoom: ${initialZoom}, detectRetina: true, tileSize: 512, zoomOffset: -1 }).addTo(map);
              } 
              else if (layer === 'satellite') {
                var url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
                baseLayer = L.tileLayer(url, { maxZoom: 19, minZoom: ${initialZoom}, detectRetina: true, tileSize: 512, zoomOffset: -1 }).addTo(map);
              } 
              else if (layer === 'terrain') {
                var url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
                baseLayer = L.tileLayer(url, { 
                  maxZoom: 17,  
                  minZoom: ${initialZoom}, 
                  detectRetina: true 
                }).addTo(map);

                if (theme === 'dark') {
                  baseLayer.on('add', function(e) {
                    e.target.getContainer().style.filter = 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)';
                  });
                  
                  if(baseLayer.getContainer()) baseLayer.getContainer().style.filter = 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)';
                }
              }
            }
          } catch{ }
        }
        window.addEventListener('message', function(e){ handleMessage(e.data); });
        document.addEventListener('message', function(e){ handleMessage(e.data); });
      </script>
    </body>
    </html>`;

    const WebComponent = Platform.OS === "web" ? WebWebView : WebView;

    return (
      <View className="flex-1 bg-black">
        <WebComponent
          originWhitelist={["*"]}
          source={{ html }}
          className="flex-1 w-full h-full bg-black"
          javaScriptEnabled
          domStorageEnabled
          ref={ref}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          scalesPageToFit={Platform.OS === "android"}
          onMessage={(e: any) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (onMapMessage) onMapMessage(msg);
            } catch {}
          }}
        />
      </View>
    );
  },
);

ShadcnMap.displayName = "ShadcnMap";

export default ShadcnMap;

