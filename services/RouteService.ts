import { useEffect, useState } from "react";
import { RouteCacheService } from "./RouteCacheService";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteInfo {
  duration: number;
  distance: number;
  instruction: string;
  label?: string;
}

export interface NavigationData {
  routeData: any;
  totalDuration: number;
  totalDistance: number;
  steps: {
    instruction: string;
    name?: string;
    distance: number;
    duration: number;
    coordinates?: [number, number][];
    maneuver?: {
      type?: string;
      modifier?: string;
      exit?: number;
      location?: [number, number];
    };
  }[];
}

export interface RouteService {
  routeCoords: Coordinate[];
  destination: Coordinate | null;
  routeInfo: RouteInfo | null;
  isCalculating: boolean;
  isOsrmAvailable: boolean;
  lastOsrmCheck?: number;
  routingHost: string;
  routingErrorMessage: string | null;
  getRoute: (
    start: Coordinate,
    end: Coordinate,
    mode?: string,
  ) => Promise<boolean>;
  getRoutes: (
    waypoints: Coordinate[],
    mode?: string,
    options?: {
      alternatives?: number;
      avoidTolls?: boolean;
      avoidHighways?: boolean;
      transitOptions?: {
        datetime?: string;
        datetimeRepresents?: "departure" | "arrival";
        forbiddenModes?: string[];
      };
    },
  ) => Promise<{ 
    coords: Coordinate[]; 
    duration: number; 
    distance: number; 
    transitLines?: any[];
    sections?: { coords: Coordinate[]; color?: string; type: string }[];
    rawJourney?: any;
  }[]>;
  getMultiStepRoute: (
    waypoints: Coordinate[],
    mode?: string,
  ) => Promise<boolean>;
  clearRoute: () => void;
  clearRouteKeepDestination: () => void;
  setDestination: (d: Coordinate | null) => void;
  directLineCoords: Coordinate[];
  nearestRoadPoint: Coordinate | null;
  hasDirectLineSegment: boolean;
  getHybridRoute: (
    start: Coordinate,
    end: Coordinate,
    mode?: string,
  ) => Promise<boolean>;
  getDistanceToRoute: (location: Coordinate) => number;
  detectOffRoute: (location: Coordinate, tolerance?: number) => boolean;
  isOnRoute: (currentLocation: Coordinate, tolerance?: number) => boolean;
  recalculateIfOffRoute: (
    currentLocation: Coordinate,
    mode?: string,
  ) => Promise<Coordinate | false>;
  lastRequestTimings: {
    host: string;
    durationMs: number;
    success: boolean;
    endpoint?: string;
  }[];
  lastRawRouteData?: any | null;
  lastAlternatives?: {
    coords: Coordinate[];
    duration: number;
    distance: number;
    transitLines?: any[];
  }[];
  selectAlternative?: (index: number) => boolean;
  getNavigationData: () => NavigationData | null;
  isOffRoute: boolean;
  updateRouteData: (newRouteData: any) => void;
  forceExtractCoordinates: () => void;
  isFromCache: boolean;
  getSpeedLimit: (points: Coordinate[]) => Promise<string | null>;
}

export type TransportMode = "driving" | "walking" | "bicycling" | "transit";

const getRoutingOSMHost = (mode: string = "driving"): string => {
  if (mode === "walking") return "https://routing.openstreetmap.de/routed-foot";
  if (mode === "bicycling")
    return "https://routing.openstreetmap.de/routed-bike";
  if (mode === "transit") return "https://4021.fr1.orionhost.xyz";
  return "https://router.project-osrm.org";
};

const DEFAULT_OSRM_HOSTS = ["https://router.project-osrm.org"];

const DEBUG_CACHE_ENABLED = true; // true to enabled route cache

export function useRouteService(): RouteService {
  const [routeCoords, setRouteCoords] = useState<Coordinate[]>([]);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isOsrmAvailable, setIsOsrmAvailable] = useState(true);
  const [lastOsrmCheck, setLastOsrmCheck] = useState<number | undefined>(
    undefined,
  );
  const [routingHost, setRoutingHost] = useState<string>(DEFAULT_OSRM_HOSTS[0]);
  const [lastRequestTimings, setLastRequestTimings] = useState<
    { host: string; durationMs: number; success: boolean; endpoint?: string }[]
  >([]);
  const [lastRawRouteData, setLastRawRouteData] = useState<any | null>(null);
  const [lastAlternatives, setLastAlternatives] = useState<
    { 
      coords: Coordinate[]; 
      duration: number; 
      distance: number; 
      transitLines?: any[];
      sections?: { coords: Coordinate[]; color?: string; type: string }[];
      rawJourney?: any;
    }[]
  >([]);
  const [isFromCache, setIsFromCache] = useState(false);

  const [routingErrorMessage, setRoutingErrorMessage] = useState<string | null>(
    null,
  );
  const [routingErrorTimeout, setRoutingErrorTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const [directLineCoords, setDirectLineCoords] = useState<Coordinate[]>([]);
  const [nearestRoadPoint, setNearestRoadPoint] = useState<Coordinate | null>(
    null,
  );
  const [hasDirectLineSegment, setHasDirectLineSegment] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);

  useEffect(() => {
    return () => {
      if (routingErrorTimeout) {
        clearTimeout(routingErrorTimeout);
      }
    };
  }, [routingErrorTimeout]);

  const showRoutingError = (message: string, durationMs: number = 4000) => {
    if (routingErrorTimeout) {
      clearTimeout(routingErrorTimeout);
    }

    setRoutingErrorMessage(message);

    const timeout = setTimeout(() => {
      setRoutingErrorMessage(null);
      setRoutingErrorTimeout(null);
    }, durationMs);

    setRoutingErrorTimeout(timeout);
  };

  const REQUEST_TIMEOUT = 10000;
  const fetchWithTimeout = async (
    url: RequestInfo,
    init?: RequestInit,
    timeout = REQUEST_TIMEOUT,
  ) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        ...(init || {}),
        signal: controller.signal,
      } as RequestInit);
      return res;
    } finally {
      clearTimeout(timer);
    }
  };

  const toRadians = (d: number) => d * (Math.PI / 180);

  const computeLabel = (raw: any): string | undefined => {
    try {
      const osrmSummary = raw?.routes?.[0]?.legs?.[0]?.summary;
      if (osrmSummary && typeof osrmSummary === "string" && osrmSummary.trim())
        return `via ${osrmSummary}`;

      const featSummary = raw?.features?.[0]?.properties?.summary?.name;
      if (featSummary && typeof featSummary === "string" && featSummary.trim())
        return `via ${featSummary}`;

      return undefined;
    } catch {
      return undefined;
    }
  };
  const calculateDistance = (a: Coordinate, b: Coordinate) => {
    const R = 6371000;
    const dLat = toRadians(b.latitude - a.latitude);
    const dLon = toRadians(b.longitude - a.longitude);
    const sinDlat = Math.sin(dLat / 2);
    const sinDlon = Math.sin(dLon / 2);
    const c =
      sinDlat * sinDlat +
      Math.cos(toRadians(a.latitude)) *
        Math.cos(toRadians(b.latitude)) *
        sinDlon *
        sinDlon;
    return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
  };

  const calculateDistanceToLineSegment = (
    point: Coordinate,
    a: Coordinate,
    b: Coordinate,
  ) => {
    if (!a || !b) return calculateDistance(point, a);
    const proj = getClosestPointOnSegment(point, a, b);
    return calculateDistance(point, proj);
  };

  const getClosestPointOnSegment = (
    point: Coordinate,
    a: Coordinate,
    b: Coordinate,
  ): Coordinate => {
    const R = 6371000;
    const toRad = toRadians;
    const latMean = toRad((a.latitude + b.latitude) / 2);

    const bx = toRad(b.longitude - a.longitude) * Math.cos(latMean) * R;
    const by = toRad(b.latitude - a.latitude) * R;

    const px = toRad(point.longitude - a.longitude) * Math.cos(latMean) * R;
    const py = toRad(point.latitude - a.latitude) * R;

    const dot = px * bx + py * by;
    const lenSq = bx * bx + by * by;
    if (lenSq === 0) return a;
    let param = dot / lenSq;
    if (param <= 0) return { latitude: a.latitude, longitude: a.longitude };
    if (param >= 1) return { latitude: b.latitude, longitude: b.longitude };

    const lon = a.longitude + param * (b.longitude - a.longitude);
    const lat = a.latitude + param * (b.latitude - a.latitude);
    return { latitude: lat, longitude: lon };
  };

  const getNearestPointOnRoute = (location: Coordinate): Coordinate | null => {
    if (!routeCoords || routeCoords.length < 2) return null;
    let bestPoint: Coordinate | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const a = routeCoords[i];
      const b = routeCoords[i + 1];
      const proj = getClosestPointOnSegment(location, a, b);
      const d = calculateDistance(location, proj);
      if (d < bestDist) {
        bestDist = d;
        bestPoint = proj;
      }
    }
    return bestPoint;
  };

  const getDistanceToRoute = (location: Coordinate): number => {
    if (!routeCoords || routeCoords.length < 2) {
      return Infinity;
    }
    let bestDist = Infinity;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const a = routeCoords[i];
      const b = routeCoords[i + 1];
      const d = calculateDistanceToLineSegment(location, a, b);
      if (d < bestDist) bestDist = d;
    }
    return bestDist;
  };

  const detectOffRoute = (
    location: Coordinate,
    tolerance: number = 20,
  ): boolean => {
    const d = getDistanceToRoute(location);
    const currentlyOffRoute = d === Infinity ? false : d > tolerance;

    if (isOffRoute && !currentlyOffRoute) {
      setIsOffRoute(false);
    } else if (!isOffRoute && currentlyOffRoute) {
      setIsOffRoute(true);
    }

    return currentlyOffRoute;
  };

  const isOnRoute = (currentLocation: Coordinate, tolerance = 50) => {
    if (!routeCoords || routeCoords.length < 2) return false;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const a = routeCoords[i];
      const b = routeCoords[i + 1];
      if (calculateDistanceToLineSegment(currentLocation, a, b) <= tolerance) {
        if (isOffRoute) {
          setIsOffRoute(false);
        }
        return true;
      }
    }
    return false;
  };

  const findNearestRoadPoint = async (
    location: Coordinate,
    mode = "driving",
  ): Promise<Coordinate | null> => {
    setLastRequestTimings([]);
    const osrmMode = mode === "bicycling" ? "bike" : mode;
    const host = getRoutingOSMHost(mode);
    const startTs = Date.now();
    try {
      const url = `${host}/nearest/v1/${osrmMode}/${location.longitude},${location.latitude}?number=1`;
      const res = await fetchWithTimeout(url);
      const duration = Date.now() - startTs;
      const ok = res.ok;
      let data: any = null;
      try {
        data = await res.json();
      } catch {}
      setLastRequestTimings(() => [
        { host, durationMs: duration, success: ok, endpoint: "nearest" },
      ]);
      if (!ok) return null;
      if (data?.waypoints?.length) {
        setIsOsrmAvailable(true);
        setLastOsrmCheck(Date.now());
        setRoutingHost(host);
        const nearest = data.waypoints[0];
        return {
          latitude: nearest.location[1],
          longitude: nearest.location[0],
        };
      }
      return null;
    } catch {
      const duration = Date.now() - startTs;

      setLastRequestTimings(() => [
        { host, durationMs: duration, success: false, endpoint: "nearest" },
      ]);
      return null;
    }
  };

  const correctPositionToRoad = async (
    location: Coordinate,
    mode = "driving",
  ) => {
    try {
      const nearest = await findNearestRoadPoint(location, mode);
      if (!nearest) return location;
      return calculateDistance(location, nearest) <= 20 ? nearest : location;
    } catch {
      return location;
    }
  };

  const fetchParallelRoutes = async (
    start: Coordinate,
    end: Coordinate,
    mode = "driving",
    options?: {
      transitOptions?: {
        datetime?: string;
        datetimeRepresents?: "departure" | "arrival";
        forbiddenModes?: string[];
      };
    }
  ): Promise<{
    success: boolean;
    data?: any;
    host?: string;
    timings: {
      host: string;
      durationMs: number;
      success: boolean;
      endpoint?: string;
    }[];
  }> => {
    const osrmMode = mode === "bicycling" ? "bike" : mode;
    const host = getRoutingOSMHost(mode);
    const timings: {
      host: string;
      durationMs: number;
      success: boolean;
      endpoint?: string;
    }[] = [];

    const startTs = Date.now();
    try {
      let url = `${host}/route/v1/${osrmMode}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true`;
      
      if (mode === "transit") {
        url = `${host}/navigation/transit?from_lon=${start.longitude}&from_lat=${start.latitude}&to_lon=${end.longitude}&to_lat=${end.latitude}`;
        if (options?.transitOptions) {
          const { datetime, datetimeRepresents, forbiddenModes } = options.transitOptions;
          if (datetime) url += `&datetime=${datetime}`;
          if (datetimeRepresents) url += `&datetime_represents=${datetimeRepresents}`;
          if (forbiddenModes && forbiddenModes.length > 0) {
            forbiddenModes.forEach(m => url += `&forbidden_uris[]=${m}`);
          }
        }
      }
      
      const res = await fetchWithTimeout(url);
      const duration = Date.now() - startTs;
      const timing = {
        host,
        durationMs: duration,
        success: res.ok,
        endpoint: "route" as const,
      };
      timings.push(timing);

      if (!res.ok) {
        const err = new Error(String(res.status));
        showRoutingError(
          "Service de calcul d'itinéraire temporairement indisponible",
        );
        throw err;
      }

      const data = await res.json();
      if (data?.routes?.length) {
        return {
          success: true,
          data,
          host,
          timings,
        };
      } else if (data?.journeys?.length) {
        return {
          success: true,
          data,
          host,
          timings,
        };
      }

      return { success: false, timings };
    } catch {
      const duration = Date.now() - startTs;

      timings.push({ host, durationMs: duration, success: false });
      showRoutingError(
        "Service de calcul d'itinéraire temporairement indisponible",
      );
      return { success: false, timings };
    }
  };

  const fetchParallelAlternatives = async (
    waypoints: Coordinate[],
    mode = "driving",
    options: {
      alternatives?: number;
      avoidTolls?: boolean;
      avoidHighways?: boolean;
      transitOptions?: {
        datetime?: string;
        datetimeRepresents?: "departure" | "arrival";
        forbiddenModes?: string[];
      };
    } = {},
  ): Promise<{
    success: boolean;
    routes?: { coords: Coordinate[]; duration: number; distance: number }[];
    host?: string;
    rawData?: any;
    timings: {
      host: string;
      durationMs: number;
      success: boolean;
      endpoint?: string;
    }[];
  }> => {
    const osrmMode = mode === "bicycling" ? "bike" : mode;
    const altCount = Math.max(1, Math.min(3, options.alternatives || 1));
    const host = getRoutingOSMHost(mode);
    const timings: {
      host: string;
      durationMs: number;
      success: boolean;
      endpoint?: string;
    }[] = [];

    const startTs = Date.now();
    try {
      const coordsQuery = waypoints
        .map((wp) => `${wp.longitude},${wp.latitude}`)
        .join(";");

      const excludes: string[] = [];
      if (options.avoidHighways) excludes.push("motorway");
      if (options.avoidTolls) excludes.push("toll");
      const excludeParam = excludes.length
        ? `&exclude=${excludes.join(",")}`
        : "";
      let url = `${host}/route/v1/${osrmMode}/${coordsQuery}?overview=full&geometries=geojson&steps=true&alternatives=true${excludeParam}`;
      if (mode === "transit") {
        url = `${host}/navigation/transit?from_lon=${waypoints[0].longitude}&from_lat=${waypoints[0].latitude}&to_lon=${waypoints[waypoints.length-1].longitude}&to_lat=${waypoints[waypoints.length-1].latitude}`;
        if (options?.transitOptions) {
          const { datetime, datetimeRepresents, forbiddenModes } = options.transitOptions;
          if (datetime) url += `&datetime=${datetime}`;
          if (datetimeRepresents) url += `&datetime_represents=${datetimeRepresents}`;
          if (forbiddenModes && forbiddenModes.length > 0) {
            forbiddenModes.forEach(m => url += `&forbidden_uris[]=${m}`);
          }
        }
      }
      
      const res = await fetchWithTimeout(url);
      const duration = Date.now() - startTs;
      const timing = {
        host,
        durationMs: duration,
        success: res.ok,
        endpoint: "route" as const,
      };
      timings.push(timing);

      if (!res.ok) {
        const err = new Error(String(res.status));
        showRoutingError(
          "Service de calcul d'itinéraire temporairement indisponible",
        );
        throw err;
      }

      const data = await res.json();
      if (data?.routes?.length) {
        const routes = (data.routes as any[])
          .slice(0, altCount)
          .map((route) => ({
            coords: (route.geometry.coordinates as [number, number][]).map(
              ([lon, lat]) => ({ latitude: lat, longitude: lon }),
            ),
            duration: Math.round(route.duration / 60),
            distance: Math.round(route.distance),
          }));
        return { success: true, routes, host, rawData: data, timings };
      } else if (data?.journeys?.length) {
        const routes = (data.journeys as any[]).slice(0, altCount).map((journey) => {
          const coords: Coordinate[] = [];
          const sections: { coords: Coordinate[]; color?: string; type: string; distance?: number }[] = [];
          let distance = 0;
          const transitLines: any[] = [];
          if (journey.sections) {
            journey.sections.forEach((section: any) => {
              const secCoords: Coordinate[] = [];
              let secDistance = 0;
              if (section.geojson && section.geojson.coordinates) {
                section.geojson.coordinates.forEach((coord: [number, number], index: number) => {
                  const c = { latitude: coord[1], longitude: coord[0] };
                  coords.push(c);
                  secCoords.push(c);
                  if (index > 0) {
                    const prev = section.geojson.coordinates[index - 1];
                    secDistance += calculateDistance(
                      { latitude: prev[1], longitude: prev[0] },
                      c
                    );
                  }
                });
              }
              const info = section.display_informations;
              if (info && info.code) {
                transitLines.push(info);
              }
              distance += secDistance;
              if (secCoords.length > 0) {
                sections.push({
                  coords: secCoords,
                  color: (section.type === "public_transport" && info?.color) ? `#${info.color}` : "#0d7ff2",
                  type: section.type,
                  distance: secDistance,
                });
              }
            });
          }
          return {
            coords,
            duration: Math.round(journey.duration / 60),
            distance,
            transitLines,
            sections,
            rawJourney: journey,
          };
        });
        return { success: true, routes, host, rawData: data, timings };
      }

      return { success: false, timings };
    } catch {
      const duration = Date.now() - startTs;
      timings.push({ host, durationMs: duration, success: false });
      showRoutingError(
        "Service de calcul d'itinéraire temporairement indisponible",
      );
      return { success: false, timings };
    }
  };

  const getRoute = async (
    start: Coordinate,
    end: Coordinate,
    mode = "driving",
    options?: {
      transitOptions?: {
        datetime?: string;
        datetimeRepresents?: "departure" | "arrival";
        forbiddenModes?: string[];
      };
    }
  ) => {
    setRouteInfo(null);
    setLastRawRouteData(null);
    setIsCalculating(true);
    setLastRequestTimings([]);

    try {
      const cacheKey = RouteCacheService.generateCacheKey(
        start.latitude,
        start.longitude,
        end.latitude,
        end.longitude,
        mode,
      );

      const cachedRoute = DEBUG_CACHE_ENABLED
        ? await RouteCacheService.getCachedRoute(cacheKey)
        : null;

      if (cachedRoute) {
        setIsFromCache(true);
        setIsOsrmAvailable(true);
        setLastRawRouteData(cachedRoute.routeData);

        if (cachedRoute.routeData.routes && cachedRoute.routeData.routes.length > 0) {
          const route = cachedRoute.routeData.routes[0];
          const coords = (route.geometry.coordinates as [number, number][]).map(
            ([lon, lat]) => ({ latitude: lat, longitude: lon }),
          );
          setRouteCoords(coords);
          setDestination(end);
          setRouteInfo({
            duration: Math.round(route.duration / 60),
            distance: Math.round(route.distance),
            instruction: "Suivre l'itinéraire",
            label: computeLabel(cachedRoute.routeData),
          });
        } else if (cachedRoute.routeData.journeys && cachedRoute.routeData.journeys.length > 0) {
          const journey = cachedRoute.routeData.journeys[0];
          const coords: Coordinate[] = [];
          let distance = 0;
          if (journey.sections) {
            journey.sections.forEach((section: any) => {
              if (section.geojson && section.geojson.coordinates) {
                section.geojson.coordinates.forEach((coord: [number, number], index: number) => {
                  const c = { latitude: coord[1], longitude: coord[0] };
                  coords.push(c);
                  if (index > 0) {
                    const prev = section.geojson.coordinates[index - 1];
                    distance += calculateDistance(
                      { latitude: prev[1], longitude: prev[0] },
                      c
                    );
                  }
                });
              }
            });
          }
          setRouteCoords(coords);
          setDestination(end);
          setRouteInfo({
            duration: Math.round(journey.duration / 60),
            distance,
            instruction: "Suivre l'itinéraire",
            label: computeLabel(cachedRoute.routeData),
          });
        }

        setIsCalculating(false);
        return true;
      }

      const result = await fetchParallelRoutes(start, end, mode, options);
      setLastRequestTimings(result.timings);
      setIsFromCache(false);

      if (!result.success || !result.data || !result.host) {
        setIsOsrmAvailable(false);
        setIsCalculating(false);
        return false;
      }

      setIsOsrmAvailable(true);
      setLastOsrmCheck(Date.now());
      setRoutingHost(result.host);
      setLastRawRouteData(result.data);

      if (DEBUG_CACHE_ENABLED) {
        await RouteCacheService.setCachedRoute(cacheKey, result.data);
      }

      if (result.data.routes && result.data.routes.length > 0) {
        const route = result.data.routes[0];
        const coords = (route.geometry.coordinates as [number, number][]).map(
          ([lon, lat]) => ({ latitude: lat, longitude: lon }),
        );
        setRouteCoords(coords);
        setDestination(end);
        const duration = Math.round(route.duration / 60);
        const distance = Math.round(route.distance);
        setRouteInfo({
          duration,
          distance,
          instruction: "Suivre l'itinéraire",
          label: computeLabel(result.data),
        });
      } else if (result.data.journeys && result.data.journeys.length > 0) {
        const journey = result.data.journeys[0];
        const coords: Coordinate[] = [];
        let distance = 0;
        if (journey.sections) {
          journey.sections.forEach((section: any) => {
            if (section.geojson && section.geojson.coordinates) {
              section.geojson.coordinates.forEach((coord: [number, number], index: number) => {
                const c = { latitude: coord[1], longitude: coord[0] };
                coords.push(c);
                if (index > 0) {
                  const prev = section.geojson.coordinates[index - 1];
                  distance += calculateDistance(
                    { latitude: prev[1], longitude: prev[0] },
                    c
                  );
                }
              });
            }
          });
        }
        
        setRouteCoords(coords);
        setDestination(end);
        const duration = Math.round(journey.duration / 60);
        setRouteInfo({
          duration,
          distance,
          instruction: "Suivre l'itinéraire",
          label: computeLabel(result.data),
        });
      }

      return true;
    } catch {
      setIsOsrmAvailable(false);
      return false;
    } finally {
      setIsCalculating(false);
    }
  };

  const getMultiStepRoute = async (
    waypoints: Coordinate[],
    mode = "driving",
  ) => {
    if (!waypoints || waypoints.length < 2) return false;
    setRouteInfo(null);
    setLastRawRouteData(null);
    setIsCalculating(true);
    setLastRequestTimings([]);
    try {
      const osrmMode = mode === "bicycling" ? "bike" : mode;
      const coordsQuery = waypoints
        .map((wp) => `${wp.longitude},${wp.latitude}`)
        .join(";");
      const host = getRoutingOSMHost(mode);
      const startTs = Date.now();
      try {
        const url = `${host}/route/v1/${osrmMode}/${coordsQuery}?overview=full&geometries=geojson&steps=true`;
        const res = await fetchWithTimeout(url);
        const duration = Date.now() - startTs;
        const ok = res.ok;
        let data: any = null;
        try {
          data = await res.json();
        } catch {}
        setLastRequestTimings(() => [
          { host, durationMs: duration, success: ok, endpoint: "route" },
        ]);
        if (!ok) {
          return false;
        }
        if (data?.routes?.length) {
          setIsOsrmAvailable(true);
          setLastOsrmCheck(Date.now());
          setRoutingHost(host);
          const route = data.routes[0];
          const coords = (route.geometry.coordinates as [number, number][]).map(
            ([lon, lat]) => ({ latitude: lat, longitude: lon }),
          );
          setLastRawRouteData(data);
          setRouteCoords(coords);
          setDestination(waypoints[waypoints.length - 1]);
          const parsedDuration = Math.round(route.duration / 60);
          const parsedDistance = Math.round(route.distance);
          setRouteInfo({
            duration: parsedDuration,
            distance: parsedDistance,
            instruction: "Suivre l'itinéraire",
            label: computeLabel(data),
          });
          return true;
        }

        return false;
      } catch {
        const duration = Date.now() - startTs;
        setLastRequestTimings(() => [
          { host, durationMs: duration, success: false },
        ]);
        return false;
      }
    } catch {
      setIsOsrmAvailable(false);
      return false;
    } finally {
      setIsCalculating(false);
    }
  };

  const getRoutes = async (
    waypoints: Coordinate[],
    mode: string = "driving",
    options: {
      alternatives?: number;
      avoidTolls?: boolean;
      avoidHighways?: boolean;
    } = {},
  ): Promise<
    { coords: Coordinate[]; duration: number; distance: number; transitLines?: any[] }[]
  > => {
    if (!waypoints || waypoints.length < 2) return [];

    setRouteInfo(null);
    setLastRawRouteData(null);
    setIsCalculating(true);
    setLastRequestTimings([]);

    try {
      const cacheKey = RouteCacheService.generateCacheKey(
        waypoints[0].latitude,
        waypoints[0].longitude,
        waypoints[waypoints.length - 1].latitude,
        waypoints[waypoints.length - 1].longitude,
        mode,
        options,
      );

      const cachedRoute = DEBUG_CACHE_ENABLED
        ? await RouteCacheService.getCachedRoute(cacheKey)
        : null;

      if (cachedRoute && cachedRoute.alternatives) {
        setIsOsrmAvailable(true);
        setLastRawRouteData(cachedRoute.routeData);

        if (cachedRoute.alternatives.length > 0) {
          setRouteCoords(cachedRoute.alternatives[0].coords);
          setDestination(waypoints[waypoints.length - 1]);
          setRouteInfo({
            duration: cachedRoute.alternatives[0].duration,
            distance: cachedRoute.alternatives[0].distance,
            instruction: "Suivre l'itinéraire",
            label: computeLabel(cachedRoute.routeData),
          });
          setLastAlternatives(cachedRoute.alternatives);
        }

        setIsCalculating(false);
        return cachedRoute.alternatives;
      }

      const result = await fetchParallelAlternatives(waypoints, mode, options);
      setLastRequestTimings(result.timings);

      if (!result.success || !result.routes || !result.host) {
        setIsOsrmAvailable(false);
        setLastAlternatives([]);
        return [];
      }

      setIsOsrmAvailable(true);
      setLastOsrmCheck(Date.now());
      setRoutingHost(result.host);
      setLastRawRouteData(result.rawData);

      if (result.routes.length > 0) {
        if (DEBUG_CACHE_ENABLED) {
          await RouteCacheService.setCachedRoute(
            cacheKey,
            result.rawData,
            result.routes,
          );
        }

        setRouteCoords(result.routes[0].coords);
        setDestination(waypoints[waypoints.length - 1]);
        setRouteInfo({
          duration: result.routes[0].duration,
          distance: result.routes[0].distance,
          instruction: "Suivre l'itinéraire",
          label: computeLabel(result.rawData),
        });
        setLastAlternatives(result.routes);
      } else {
        setLastAlternatives([]);
      }

      return result.routes;
    } catch {
      setIsOsrmAvailable(false);
      setLastAlternatives([]);
      return [];
    } finally {
      setIsCalculating(false);
    }
  };

  const selectAlternative = (index: number) => {
    if (!lastAlternatives || lastAlternatives.length === 0) return false;
    const clamped = Math.max(0, Math.min(lastAlternatives.length - 1, index));
    const alt = lastAlternatives[clamped];
    if (!alt) return false;
    setRouteCoords(alt.coords);
    setRouteInfo({
      duration: alt.duration,
      distance: alt.distance,
      instruction: "Suivre l'itinéraire",
      label: computeLabel(lastRawRouteData),
    });
    return true;
  };

  const getHybridRoute = async (
    start: Coordinate,
    end: Coordinate,
    mode = "driving",
  ) => {
    setRouteInfo(null);
    setLastRawRouteData(null);
    setIsCalculating(true);
    setLastRequestTimings([]);
    try {
      const correctedStart = await correctPositionToRoad(start, mode);

      const nearestStart = await findNearestRoadPoint(correctedStart, mode);

      if (!nearestStart) {
        return false;
      }

      const distanceToRoad = calculateDistance(correctedStart, nearestStart);

      let finalRouteCoords: Coordinate[] = [];
      let finalRouteData: any = null;

      if (distanceToRoad > 100) {
        setDirectLineCoords([correctedStart, nearestStart]);
        setNearestRoadPoint(nearestStart);

        const osrmMode = mode === "bicycling" ? "bike" : mode;
        const host = getRoutingOSMHost(mode);
        const startTs = Date.now();
        try {
          const url = `${host}/route/v1/${osrmMode}/${nearestStart.longitude},${nearestStart.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true`;
          const res = await fetchWithTimeout(url);
          const duration = Date.now() - startTs;
          const ok = res.ok;
          let data: any = null;
          try {
            data = await res.json();
          } catch {}
          setLastRequestTimings(() => [
            { host, durationMs: duration, success: ok, endpoint: "route" },
          ]);
          if (ok && data?.routes?.length) {
            finalRouteCoords = data.routes[0].geometry.coordinates.map(
              ([lon, lat]: [number, number]) => ({
                latitude: lat,
                longitude: lon,
              }),
            );
            finalRouteData = data;
          }
        } catch {
          const duration = Date.now() - startTs;
          setLastRequestTimings(() => [
            { host, durationMs: duration, success: false },
          ]);
        }
      } else {
        const osrmMode = mode === "bicycling" ? "bike" : mode;
        const host = getRoutingOSMHost(mode);
        const startTs = Date.now();
        try {
          const url = `${host}/route/v1/${osrmMode}/${correctedStart.longitude},${correctedStart.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true`;
          const res = await fetchWithTimeout(url);
          const duration = Date.now() - startTs;
          const ok = res.ok;
          let data: any = null;
          try {
            data = await res.json();
          } catch {}
          setLastRequestTimings(() => [
            { host, durationMs: duration, success: ok, endpoint: "route" },
          ]);
          if (ok && data?.routes?.length) {
            setIsOsrmAvailable(true);
            setLastOsrmCheck(Date.now());
            setRoutingHost(host);
            const route = data.routes[0];
            const routeCoords = route.geometry.coordinates.map(
              ([lon, lat]: [number, number]) => ({
                latitude: lat,
                longitude: lon,
              }),
            );
            setLastRawRouteData(data);
            setRouteCoords(routeCoords);
            setRouteInfo({
              duration: Math.round(route.duration / 60),
              distance: Math.round(route.distance),
              instruction: "Suivre l'itinéraire",
              label: computeLabel(data),
            });
            setDirectLineCoords([]);
            setNearestRoadPoint(null);
            return true;
          }
        } catch {
          const duration = Date.now() - startTs;
          setLastRequestTimings(() => [
            { host, durationMs: duration, success: false },
          ]);
        }
      }

      if (finalRouteCoords && finalRouteCoords.length) {
        setLastRawRouteData(finalRouteData);
        setRouteCoords(finalRouteCoords);
        setDestination(end);
        setDirectLineCoords([]);
        setNearestRoadPoint(null);
        setHasDirectLineSegment(false);
        return true;
      }

      return false;
    } catch {
      setIsOsrmAvailable(false);
      return false;
    } finally {
      setIsCalculating(false);
    }
  };

  const recalculateIfOffRoute = async (
    currentLocation: Coordinate,
    mode: string = "driving",
  ) => {
    if (!destination) return false;
    const OFF_ROUTE_TOLERANCE = 20;
    const onRoute = isOnRoute(currentLocation, OFF_ROUTE_TOLERANCE);
    if (!onRoute) {
      const ok = await getHybridRoute(currentLocation, destination, mode);
      if (ok) {
        setIsOffRoute(false);
        return currentLocation;
      }
      return false;
    }
    return false;
  };

  const clearRoute = () => {
    setRouteCoords([]);
    setDestination(null);
    setRouteInfo(null);
    setDirectLineCoords([]);
    setNearestRoadPoint(null);
    setHasDirectLineSegment(false);
    setLastAlternatives([]);
    setIsOffRoute(false);
    if (routingErrorTimeout) {
      clearTimeout(routingErrorTimeout);
      setRoutingErrorTimeout(null);
    }
    setRoutingErrorMessage(null);
  };

  const clearRouteKeepDestination = () => {
    setRouteCoords([]);
    setRouteInfo(null);
    setDirectLineCoords([]);
    setNearestRoadPoint(null);
    setHasDirectLineSegment(false);
    setLastAlternatives([]);
    setIsOffRoute(false);
    if (routingErrorTimeout) {
      clearTimeout(routingErrorTimeout);
      setRoutingErrorTimeout(null);
    }
    setRoutingErrorMessage(null);
  };

  const getNavigationData = (): NavigationData | null => {
    if (!lastRawRouteData) return null;

    try {
      if (lastRawRouteData.routes && lastRawRouteData.routes[0]) {
        const route = lastRawRouteData.routes[0];
        const legs = route.legs || [];
        const steps = legs.flatMap((leg: any) => leg.steps || []);

        return {
          routeData: lastRawRouteData,
          totalDuration: route.duration || 0,
          totalDistance: route.distance || 0,
          steps: steps.map((step: any) => ({
            instruction: step.maneuver?.instruction || step.name || "",
            name: step.name || undefined,
            distance: step.distance || 0,
            duration: step.duration || 0,
            coordinates: step.geometry?.coordinates,
            maneuver: {
              type: step.maneuver?.type,
              modifier: step.maneuver?.modifier,
              exit:
                typeof step.maneuver?.exit === "number"
                  ? step.maneuver.exit
                  : undefined,
              location: step.maneuver?.location || undefined,
            },
          })),
        };
      }

      if (lastRawRouteData.features && lastRawRouteData.features[0]) {
        const feature = lastRawRouteData.features[0];
        const segments = feature.properties?.segments || [];
        const steps = segments.flatMap((seg: any) => seg.steps || []);

        return {
          routeData: lastRawRouteData,
          totalDuration: feature.properties?.summary?.duration || 0,
          totalDistance: feature.properties?.summary?.distance || 0,
          steps: steps.map((step: any) => ({
            instruction: step.instruction || "",
            distance: step.distance || 0,
            duration: step.duration || 0,
            coordinates: step.way_points ? [step.way_points] : undefined,
            maneuver: undefined,
          })),
        };
      }

      if (lastRawRouteData.trip && lastRawRouteData.trip.legs) {
        const legs = lastRawRouteData.trip.legs;
        const allManeuvers = legs.flatMap((leg: any) => leg.maneuvers || []);

        return {
          routeData: lastRawRouteData,
          totalDuration: lastRawRouteData.trip.summary?.time || 0,
          totalDistance: lastRawRouteData.trip.summary?.length || 0,
          steps: allManeuvers.map((maneuver: any) => ({
            instruction: maneuver.instruction || "",
            distance: maneuver.length || 0,
            duration: maneuver.time || 0,
            coordinates: undefined,
            maneuver: {
              type: maneuver.type || maneuver.action,
              modifier: maneuver.direction || undefined,
            },
          })),
        };
      }
    } catch {}

    return null;
  };

  const handleDestinationChange = (d: Coordinate | null) => setDestination(d);

  const updateRouteData = (newRouteData: any) => {
    if (!newRouteData) return;

    setLastRawRouteData(newRouteData);

    let newRouteCoords: Coordinate[] = [];

    if (newRouteData.features && newRouteData.features.length > 0) {
      const route = newRouteData.features[0];
      newRouteCoords = route.geometry.coordinates.map(
        ([lon, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lon,
        }),
      );
    } else if (newRouteData.routes && newRouteData.routes.length > 0) {
      const route = newRouteData.routes[0];
      newRouteCoords = route.geometry.coordinates.map(
        ([lon, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lon,
        }),
      );
    }

    if (newRouteCoords.length > 0) {
      setRouteCoords(newRouteCoords);
    }
  };

  const forceExtractCoordinates = () => {
    if (!lastRawRouteData) {
      return;
    }
    updateRouteData(lastRawRouteData);
  };

  const getSpeedLimit = async (
    points: Coordinate[],
  ): Promise<string | null> => {
    if (!points || points.length < 2) return null;

    const body = {
      shape: points.map((p) => ({ lat: p.latitude, lon: p.longitude })),
      costing: "auto",
      shape_match: "map_snap",
      filters: {
        attributes: ["speed_limit", "speed", "edge.names"],
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(
        "https://valhalla1.openstreetmap.de/trace_attributes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Octara-Maps/1.0",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data.edges && data.edges.length > 0) {
        for (const edge of data.edges) {
          if (edge.speed_limit && edge.speed_limit > 0) {
            return edge.speed_limit.toString();
          }
        }

        for (const edge of data.edges) {
          if (edge.speed && edge.speed > 0) {
            return edge.speed.toString();
          }
        }
      }
      return null;
    } catch {
      clearTimeout(timeout);
      return null;
    }
  };

  return {
    routeCoords,
    destination,
    routeInfo,
    isCalculating,
    isOsrmAvailable,
    lastOsrmCheck,
    routingHost,
    routingErrorMessage,
    lastRequestTimings,
    lastRawRouteData,
    getRoute,
    getMultiStepRoute,
    getRoutes,
    getHybridRoute,
    clearRoute,
    clearRouteKeepDestination,
    setDestination: handleDestinationChange,
    directLineCoords,
    nearestRoadPoint,
    hasDirectLineSegment,
    isOnRoute,
    detectOffRoute,
    recalculateIfOffRoute,
    getDistanceToRoute,
    lastAlternatives,
    selectAlternative,
    getNavigationData,
    isOffRoute,
    updateRouteData,
    forceExtractCoordinates,
    isFromCache,
    getSpeedLimit,
  };
}

export async function fetchParallelRouting(
  start: Coordinate,
  end: Coordinate,
  mode: string = "driving",
  options: { alternatives?: boolean; waypoints?: Coordinate[] } = {},
): Promise<{ success: boolean; data?: any; host?: string }> {
  const REQUEST_TIMEOUT = 10000;

  const fetchWithTimeout = async (
    url: RequestInfo,
    init?: RequestInit,
    timeout = REQUEST_TIMEOUT,
  ) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        ...(init || {}),
        signal: controller.signal,
      } as RequestInit);
      return res;
    } finally {
      clearTimeout(timer);
    }
  };

  const getRoutingOSMHost = (mode: string = "driving"): string => {
    if (mode === "walking")
      return "https://routing.openstreetmap.de/routed-foot";
    if (mode === "bicycling")
      return "https://routing.openstreetmap.de/routed-bike";
    if (mode === "transit")
      return "https://4021.fr1.orionhost.xyz";
    return "https://router.project-osrm.org";
  };

  try {
    const osrmMode = mode === "bicycling" ? "bike" : mode;
    const host = getRoutingOSMHost(mode);
    let coordinates: string;

    if (options.waypoints && options.waypoints.length > 0) {
      const allPoints = [start, ...options.waypoints, end];
      coordinates = allPoints
        .map((point) => `${point.longitude},${point.latitude}`)
        .join(";");
    } else {
      coordinates = `${start.longitude},${start.latitude};${end.longitude},${end.latitude}`;
    }

    const alternativesParam = options.alternatives ? "&alternatives=true" : "";
    let url = `${host}/route/v1/${osrmMode}/${coordinates}?overview=full&geometries=geojson&steps=true${alternativesParam}`;
    if (mode === "transit") {
      url = `${host}/navigation/transit?from_lon=${start.longitude}&from_lat=${start.latitude}&to_lon=${end.longitude}&to_lat=${end.latitude}`;
      // In fetchParallelRouting we don't pass options for transitOptions right now, but could be added later.
    }

    const res = await fetchWithTimeout(url);
    if (!res.ok) return { success: false };

    const data = await res.json();
    if (data?.routes?.length) {
      return { success: true, data, host };
    } else if (data?.journeys?.length) {
      return { success: true, data, host };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}
