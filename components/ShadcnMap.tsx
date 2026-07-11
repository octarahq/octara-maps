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
        .leaflet-container { background: #000 !important; }
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
      <script src="https://unpkg.com/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.min.js"></script>
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
          zIndex: 1,
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
    map.on('touchstart', sendMove);
    map.on('mousedown', sendMove);       
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
              setTimeout(()=>map.invalidateSize(),100);
            }
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
              map.fitBounds(m.bounds, { animate: false, padding: m.padding || [24, 24] });
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
                var htmlContent = '<div style="width:20px;height:20px;position:relative;">' +
                  '<div style="box-sizing:content-box;width:16px;height:16px;background:#0d7ff2;border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.3);position:absolute;top:0;left:0;z-index:2;"></div>';
                if (m.heading != null) {
                  htmlContent += '<div style="width:20px;height:20px;position:absolute;top:0;left:0;transform:rotate(' + m.heading + 'deg);z-index:1;">' +
                    '<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:8px solid #0d7ff2;position:absolute;top:-5px;left:5px;filter:drop-shadow(0 -2px 2px rgba(0,0,0,0.3));"></div>' +
                  '</div>';
                }
                htmlContent += '</div>';
                var myIcon = L.divIcon({
                  className: '',
                  html: htmlContent,
                  iconSize: [20,20],
                  iconAnchor: [10,10]
                });
                userMarker = L.marker([lat, lng], { icon: myIcon, zIndexOffset: 1000 }).addTo(map);
              }
              if (m.center) {
                const targetZoom = m.zoom || map.getZoom();
                const point = map.project([lat, lng], targetZoom);
                point.y += (m.offsetY || 0);
                const target = map.unproject(point, targetZoom);
                if (m.animate !== false) {
                  if (m.zoom) {
                    map.flyTo(target, targetZoom, { duration: 0.8 });
                  } else {
                    map.panTo(target, { animate: true, duration: 0.5 });
                  }
                } else {
                  map.setView(target, targetZoom, { animate: false });
                }
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
            if (m.type === 'setStreetViewMarker') {
              if (window.svMarker) {
                map.removeLayer(window.svMarker);
                window.svMarker = null;
              }
              if (m.lat != null && m.lng != null) {
                var htmlContent = '<div style="width:24px;height:24px;position:relative;display:flex;align-items:center;justify-content:center;">';
                if (m.heading != null) {
                  htmlContent += '<div style="position:absolute;width:100%;height:100%;top:0;left:0;transform:rotate(' + m.heading + 'deg);z-index:1;">' +
                    '<div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:12px solid rgba(0, 174, 255, 0.7);position:absolute;top:-6px;left:4px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));"></div>' +
                  '</div>';
                }
                htmlContent += '<div style="width:16px;height:16px;background:#00aeff;border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.4);position:relative;z-index:2;"></div></div>';
                
                var svIcon = L.divIcon({
                  className: '',
                  html: htmlContent,
                  iconSize: [24,24],
                  iconAnchor: [12,12]
                });
                window.svMarker = L.marker([m.lat, m.lng], { icon: svIcon, zIndexOffset: 900 }).addTo(map);
                if (m.center) {
                  map.setView([m.lat, m.lng], map.getZoom(), { animate: true });
                }
              }
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
              var providerType = m.providerType || 'default';
              var customUrl = m.customUrl || '';
              
              if (baseLayer) { map.removeLayer(baseLayer); }
              setTimeout(()=>map.invalidateSize(),100);
              
              var url = '';
              var maxZ = 19;
              
              if (providerType === 'custom' && customUrl) {
                url = customUrl;
              } else if (layer === 'standard') {
                if (providerType === 'openfreemap') {
                  url = 'https://tiles.openfreemap.org/styles/liberty';
                } else {
                  url = 'https://{s}.basemaps.cartocdn.com/' + theme + '_all/{z}/{x}/{y}.png';
                }
              } 
              else if (layer === 'satellite') {
                if (providerType === 'ign') {
                  url = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
                } else {
                  url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
                }
              } 
              else if (layer === 'terrain') {
                if (providerType === 'opentopomap') {
                  url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
                  maxZ = 17;
                } else {
                  url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
                  maxZ = 17;
                }
              }
              
              if (!url) url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
              
              baseLayer = L.tileLayer(url, { maxZoom: maxZ, minZoom: ${initialZoom}, detectRetina: true, tileSize: 512, zoomOffset: -1, zIndex: 1 }).addTo(map);

              if (layer === 'terrain' && theme === 'dark') {
                  baseLayer.on('add', function(e) {
                    e.target.getContainer().style.filter = 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)';
                  });
                  if(baseLayer.getContainer()) baseLayer.getContainer().style.filter = 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)';
              }
            }
            if (m.type === 'setStreetView') {
              if (m.enabled) {
                if (window.streetViewLayer) {
                  map.removeLayer(window.streetViewLayer);
                  window.streetViewLayer = null;
                }
                var svUrl = 'https://panoramax.ign.fr/api/map/{z}/{x}/{y}.mvt';
                window.streetViewLayer = L.vectorGrid.protobuf(svUrl, {
                  zIndex: 9,
                  vectorTileLayerStyles: {
                    sequences: {
                      weight: 2,
                      color: '#00aeff',
                      opacity: 0.8,
                      radius: 0,
                      fill: false
                    },
                    pictures: [],
                    images: []
                  },
                  interactive: true,
                  maxNativeZoom: 15,
                  maxZoom: 19
                });
                window.streetViewLayer.addTo(map);
                window.streetViewLayer.on('click', function(e) {
                  L.DomEvent.stopPropagation(e);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'streetViewClick',
                    lat: e.latlng.lat,
                    lng: e.latlng.lng
                  }));
                });
              } else {
                if (window.streetViewLayer) {
                  map.removeLayer(window.streetViewLayer);
                  window.streetViewLayer = null;
                }
              }
            }
            if (m.type === 'setPublicTransport') {
              if (m.enabled) {
                if (window.transitLayer) {
                  map.removeLayer(window.transitLayer);
                  window.transitLayer = null;
                }
                var transitUrl = 'https://4021.fr1.orionhost.xyz/tiles/transit/{z}/{x}/{y}';
                window.transitLayer = L.vectorGrid.protobuf(transitUrl, {
                  zIndex: 10,
                  vectorTileLayerStyles: {
                      transit_idfm: function(properties, zoom) {
                        
                        if (properties.stop_id) {
                          var busSvgUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg viewBox="0 -960 960 960" width="24" height="24" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="-960" width="960" height="960" rx="200" fill="#5f6368" /><path fill="#ffffff" d="M320-200v20q0 25-17.5 42.5T260-120q-25 0-42.5-17.5T200-180v-62q-18-20-29-44.5T160-340v-380q0-83 77-121.5T480-880q172 0 246 37t74 123v380q0 29-11 53.5T760-242v62q0 25-17.5 42.5T700-120q-25 0-42.5-17.5T640-180v-20H320Zm162-560h224-448 224Zm158 280H240h480-80Zm-400-80h480v-120H240v120Zm142.5 222.5Q400-355 400-380t-17.5-42.5Q365-440 340-440t-42.5 17.5Q280-405 280-380t17.5 42.5Q315-320 340-320t42.5-17.5Zm280 0Q680-355 680-380t-17.5-42.5Q645-440 620-440t-42.5 17.5Q560-405 560-380t17.5 42.5Q595-320 620-320t42.5-17.5ZM258-760h448q-15-17-64.5-28.5T482-800q-107 0-156.5 12.5T258-760Zm62 480h320q33 0 56.5-23.5T720-360v-120H240v120q0 33 23.5 56.5T320-280Z" /></svg>');
                          return {
                            radius: 15,
                            icon: L.icon({
                              iconUrl: busSvgUrl,
                              iconSize: [2, 2],
                              iconAnchor: [1, 1]
                            })
                          };
                        }
                        var w = 0.3; 
                        if (zoom >= 14) w = 0.5;
                        
                        var rc = properties.route_color || '';
                        var color = rc ? (rc.startsWith('#') ? rc : '#' + rc) : '#888888';
                        
                        return { 
                            weight: w, 
                            color: color, 
                            opacity: 1,
                            lineCap: 'round', 
                            lineJoin: 'round' 
                        };
                      }
                    },
                    interactive: true,
                    maxNativeZoom: 14,
                    getFeatureId: function(f) { return f.properties.stop_id; }
                  });
                  window.transitLayer.on('click', function(e) {
                    if (e.layer.properties && e.layer.properties.stop_id) {
                      try {
                        postToApp({ 
                          type: 'transitStopClicked', 
                          id: e.layer.properties.stop_id, 
                          name: e.layer.properties.stop_name 
                        });
                      } catch(err){}
                    }
                  });
                window.transitLayer.addTo(map);
              } else {
                if (window.transitLayer) {
                  map.removeLayer(window.transitLayer);
                  window.transitLayer = null;
                }
              }
            }
          } catch(err) {
            try {
              postToApp({ type: 'error', message: err.message, stack: err.stack });
            } catch(e) {}
          }
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
          key={html.length}
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

