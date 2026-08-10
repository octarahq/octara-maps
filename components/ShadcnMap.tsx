import {
  AbnormalTrafficSvg,
  AccidentSvg,
  addressSvg,
  AnimalPresenceObstructionSvg,
  AuthorityOperationSvg,
  ConstructionWorksSvg,
  EnvironmentalObstructionSvg,
  GeneralObstructionSvg,
  InfrastructureDamageObstructionSvg,
  NonWeatherRelatedRoadConditionsSvg,
  VehicleObstructionSvg,
  WarningSvg,
} from "@/assets/icons/svgStrings";
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
  options?: { enableLongPress?: boolean };
};

const ShadcnMap = React.forwardRef<any, Props>(
  ({ initialZoom = 2, onMapMessage, options }, ref) => {
    const addressSvgString = addressSvg("#0d7ff2");

    const trafficSvgs = {
      Accident: AccidentSvg(),
      AbnormalTraffic: AbnormalTrafficSvg(),
      ConstructionWorks: ConstructionWorksSvg(),
      AnimalPresenceObstruction: AnimalPresenceObstructionSvg(),
      EnvironmentalObstruction: EnvironmentalObstructionSvg(),
      AuthorityOperation: AuthorityOperationSvg(),
      Warning: WarningSvg(),
      VehicleObstruction: VehicleObstructionSvg(),
      GeneralObstruction: GeneralObstructionSvg(),
      NonWeatherRelatedRoadConditions: NonWeatherRelatedRoadConditionsSvg(),
      InfrastructureDamageObstruction: InfrastructureDamageObstructionSvg(),
    };

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
          perspective: 1200px;
          perspective-origin: 50% 20%;
        }
        #mapRotate {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 260vmax;
          height: 260vmax;
          margin-left: -130vmax;
          margin-top: -130vmax;
          transform-style: preserve-3d;
          transition: top 0.5s ease-out, transform 1s linear;
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
          attributionControl: false,
          zoomSnap: 0,
          zoomDelta: 0.5,
          wheelPxPerZoomLevel: 120,
          renderer: L.svg({ padding: 0.2 })
        }).setView([0,0], ${initialZoom});

        var baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
          maxZoom: 19,
          tileSize: 512,
          zoomOffset: -1,
          zIndex: 1,
          keepBuffer: 8
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
    map.on('zoom', function() {
      var z = map.getZoom();
      if (routePolyline) routePolyline.setStyle({ weight: getRouteWeight(z) });
      if (overlayPolylines && overlayPolylines.length > 0) {
        overlayPolylines.forEach(function(p) { p.setStyle({ weight: getRouteWeight(z) * 1.5 }); });
      }
    });
    map.on('moveend', function(){ try { postToApp({ type: 'centerChanged', lat: map.getCenter().lat, lng: map.getCenter().lng }); } catch(e) {} });

    var pressTimer = null;
    var pressStartX = 0;
    var pressStartY = 0;

    function startPress(e) {
      if (e.type === 'touchstart' && e.touches && e.touches.length > 1) return;
      var clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      var clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      pressStartX = clientX;
      pressStartY = clientY;
      
      pressTimer = setTimeout(function() {
        if (pressTimer) {
          var rect = map.getContainer().getBoundingClientRect();
          var point = L.point(clientX - rect.left, clientY - rect.top);
          var latlng = map.containerPointToLatLng(point);
          try {
            if (${!!options?.enableLongPress}) {
              postToApp({ type: 'mapLongPress', lat: latlng.lat, lng: latlng.lng });
            }
          } catch(err) {}
          pressTimer = null;
        }
      }, 500);
    }

    function movePress(e) {
      if (pressTimer) {
        var clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        var clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        var dx = clientX - pressStartX;
        var dy = clientY - pressStartY;
        if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      }
    }

    function endPress(e) {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    }

    var mc = document.getElementById('mapViewport');
    if (mc) {
      mc.addEventListener('mousedown', startPress, { passive: true });
      mc.addEventListener('touchstart', startPress, { passive: true });
      mc.addEventListener('mousemove', movePress, { passive: true });
      mc.addEventListener('touchmove', movePress, { passive: true });
      window.addEventListener('mouseup', endPress, { passive: true });
      window.addEventListener('touchend', endPress, { passive: true });
      window.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    }
    var currentBearing = 0;
    var targetBearing = 0;
    var currentPitch = 0;
    var targetPitch = 0;
    var bearingRaf = null;
    var userMarker = null;
    var markers = [];
    var routePolyline = null;
    var overlayPolylines = [];

        function getRouteWeight(z) {
          if (z >= 18) return 24;
          if (z >= 17) return 18;
          if (z >= 16) return 12;
          if (z >= 15) return 9;
          if (z >= 14) return 7;
          if (z >= 12) return 5;
          return 4;
        }

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

        var currentAccumulatedBearing = 0;
        
        function applyBearingTransform(accumAngle, pitch) {
          var rotateEl = document.getElementById('mapRotate');
          if (!rotateEl) return;

          rotateEl.style.transform = 'perspective(1200px) rotateX(' + (pitch || 0) + 'deg) rotate(' + (-accumAngle) + 'deg)';
        }

        function applyBearing(angle, pitch) {
          if (pitch != null) targetPitch = pitch;
          
          var normalizedAngle = normalizeBearing(angle);
          var normalizedCurrent = normalizeBearing(currentAccumulatedBearing);
          var delta = shortestDelta(normalizedCurrent, normalizedAngle);
          
          currentAccumulatedBearing += delta;
          
          applyBearingTransform(currentAccumulatedBearing, targetPitch);
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
              var targetZoom = m.zoom != null ? m.zoom : map.getZoom();
              var targetLatLng = L.latLng(m.lat, m.lng);
              
              var offsetY = m.offsetY || 0;
              var rotateEl = document.getElementById('mapRotate');
              if (rotateEl) rotateEl.style.top = 'calc(50% + ' + offsetY + 'px)';

              if (m.zoom != null) {
                map.setView(targetLatLng, targetZoom, { animate: m.animate !== false, duration: m.duration || 0.6 });
              } else {
                map.panTo(targetLatLng, { animate: m.animate !== false, duration: m.duration || 0.6 });
              }
              if (m.bearing != null || m.pitch != null) {
                applyBearing(m.bearing != null ? m.bearing : currentBearing, m.pitch);
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
              
              if (iconType === 'address') {
                if (userMarker) {
                  map.removeLayer(userMarker);
                  userMarker = null;
                }
                const svg = ${JSON.stringify(addressSvgString)};
                const myIcon = L.divIcon({
                  className: 'user-nav-address',
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
                
                if (userMarker && userMarker.options.icon.options.className === 'user-nav-marker') {
                  userMarker.setLatLng([lat, lng]);
                  var el = userMarker.getElement();
                  if (el) el.innerHTML = htmlContent;
                } else {
                  if (userMarker) {
                    map.removeLayer(userMarker);
                  }
                  var myIcon = L.divIcon({
                    className: 'user-nav-marker',
                    html: htmlContent,
                    iconSize: [20,20],
                    iconAnchor: [10,10]
                  });
                  userMarker = L.marker([lat, lng], { icon: myIcon, zIndexOffset: 1000 }).addTo(map);
                }
              }
              if (m.center) {
                const targetZoom = m.zoom || map.getZoom();
                const target = L.latLng(lat, lng);
                
                var offsetY = m.offsetY || 0;
                var rotateEl = document.getElementById('mapRotate');
                if (rotateEl) rotateEl.style.top = 'calc(50% + ' + offsetY + 'px)';
                
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
              if (m.latlngs && m.latlngs.length > 1) {
                if (routePolyline) {
                  routePolyline.setLatLngs(m.latlngs);
                } else {
                  var polylineOpts = { color: m.color || '#0d7ff2', weight: getRouteWeight(map.getZoom()), opacity: m.opacity || 1.0 };
                  if (m.dashArray) polylineOpts.dashArray = m.dashArray;
                  routePolyline = L.polyline(m.latlngs, polylineOpts).addTo(map);
                }
              } else if (routePolyline) {
                map.removeLayer(routePolyline);
                routePolyline = null;
              }
            }
            if (m.type === 'addOverlayPolyline') {
              if (m.latlngs && m.latlngs.length > 1) {
                var polylineOpts = { color: m.color || '#fff', weight: getRouteWeight(map.getZoom()) * 0.6, opacity: m.opacity || 1 };
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
              
              baseLayer = L.tileLayer(url, { maxZoom: maxZ, minZoom: ${initialZoom}, detectRetina: true, tileSize: 512, zoomOffset: -1, zIndex: 1, keepBuffer: 8 }).addTo(map);

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
            if (m.type === 'setTraffic') {
              if (m.enabled) {
                if (!window.trafficLayerGroup) {
                  window.trafficLayerGroup = L.layerGroup().addTo(map);
                  window.trafficMarkers = new Map();
                  window.trafficTileRefs = new Map();
                  window.trafficGridEvents = new Map();
                  
                  window.trafficGridLayer = L.gridLayer({ zIndex: 10, updateWhenIdle: false });
                  var trafficSvgs = ${JSON.stringify(trafficSvgs)};
                  var getIconSvg = function(type) {
                    if (type === 'MaintenanceWorks' || type === 'RoadOrCarriagewayOrLaneManagement') type = 'ConstructionWorks';
                    if (type === 'Conditions' || type === 'PoorEnvironmentConditions') type = 'EnvironmentalObstruction';
                    return trafficSvgs[type] || trafficSvgs['Warning'];
                  };

                  window.trafficGridLayer.createTile = function(coords, done) {
                    var tile = document.createElement('div');
                    var tileKey = coords.z + ':' + coords.x + ':' + coords.y;
                    var url = 'https://4021.fr1.orionhost.xyz/data/traffic/' + coords.z + '/' + coords.x + '/' + coords.y;
                    
                    window.trafficGridEvents.set(tileKey, []);
                    
                    fetch(url)
                      .then(function(res) { return res.json(); })
                      .then(function(data) {
                        if (!Array.isArray(data)) {
                           done(null, tile);
                           return;
                        }
                        data.forEach(function(event) {
                          window.trafficGridEvents.get(tileKey).push(event.ID);
                          
                          if (!window.trafficTileRefs.has(event.ID)) {
                            window.trafficTileRefs.set(event.ID, new Set());
                          }
                          window.trafficTileRefs.get(event.ID).add(tileKey);

                          if (!window.trafficMarkers.has(event.ID)) {
                            var color = '#f59e0b';
                            if (event.Severity === 'high') color = '#ef4444';
                            else if (event.Severity === 'low') color = '#3b82f6';
                            
                            var iconHtml = '<div style="width:28px;height:28px;background-color:' + color + ';border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.3);border:2px solid white;">' + getIconSvg(event.Type) + '</div>';
                            var customIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
                            
                            var mk = L.marker([event.Lat, event.Lon], { icon: customIcon });
                            (function(eventType) {
                              mk.on('click', function(e) {
                                L.DomEvent.stopPropagation(e);
                                postToApp({ type: 'trafficMarkerClicked', eventType: eventType });
                              });
                            })(event.Type);
                            if (window.trafficLayerGroup) {
                               mk.addTo(window.trafficLayerGroup);
                            }
                            window.trafficMarkers.set(event.ID, mk);
                          }
                        });
                        done(null, tile);
                      })
                      .catch(function(err) {
                        done(err, tile);
                      });
                      
                    return tile;
                  };
                  
                  window.trafficGridLayer.on('tileunload', function(e) {
                    var coords = e.coords;
                    var tileKey = coords.z + ':' + coords.x + ':' + coords.y;
                    var eventIDs = window.trafficGridEvents.get(tileKey);
                    
                    if (eventIDs) {
                      eventIDs.forEach(function(eventID) {
                        var keys = window.trafficTileRefs.get(eventID);
                        if (keys) {
                          keys.delete(tileKey);
                          if (keys.size === 0) {
                            var mk = window.trafficMarkers.get(eventID);
                            if (mk && window.trafficLayerGroup) {
                              window.trafficLayerGroup.removeLayer(mk);
                            }
                            window.trafficMarkers.delete(eventID);
                            window.trafficTileRefs.delete(eventID);
                          }
                        }
                      });
                      window.trafficGridEvents.delete(tileKey);
                    }
                  });
                }
                
                if (!map.hasLayer(window.trafficGridLayer)) {
                  map.addLayer(window.trafficGridLayer);
                }
              } else {
                if (window.trafficGridLayer) {
                  map.removeLayer(window.trafficGridLayer);
                  if (window.trafficLayerGroup) {
                    window.trafficLayerGroup.clearLayers();
                    map.removeLayer(window.trafficLayerGroup);
                    window.trafficLayerGroup = null;
                  }
                  window.trafficMarkers.clear();
                  window.trafficTileRefs.clear();
                  window.trafficGridEvents.clear();
                  window.trafficGridLayer = null;
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
