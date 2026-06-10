import * as Location from "expo-location";
import React from "react";

type Position = {
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  city?: string | null;
  country?: string | null;
};

type State = {
  position: Position | null;
  loading: boolean;
  error?: string | null;
  refresh: () => Promise<void>;
  startWatching: () => Promise<void>;
  stopWatching: () => void;
  setInterpolationEnabled: (enabled: boolean) => void;
};

const PositionContext = React.createContext<State | null>(null);

export function usePosition() {
  const ctx = React.useContext(PositionContext);
  if (!ctx) throw new Error("usePosition must be used within PositionProvider");
  return ctx;
}

export function PositionProvider({ children }: { children: React.ReactNode }) {
  const [position, setPosition] = React.useState<Position | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const subscriberRef = React.useRef<Location.LocationSubscription | null>(
    null,
  );
  const lastRawRef = React.useRef<{
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
    timestamp: number;
  } | null>(null);
  const animRef = React.useRef<number | null>(null);
  const interpolationRef = React.useRef(true);

  const setInterpolationEnabled = React.useCallback((enabled: boolean) => {
    interpolationRef.current = enabled;
  }, []);

  const animateTo = React.useCallback(
    (from: Position, to: Position, duration: number) => {
      if (!interpolationRef.current) {
        setPosition(to);
        return;
      }
      
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
      const start = Date.now();
      const step = () => {
        const now = Date.now();
        const t = Math.min(1, (now - start) / duration);
        const interpolated: Position = {
          latitude: from.latitude + (to.latitude - from.latitude) * t,
          longitude: from.longitude + (to.longitude - from.longitude) * t,
          speed: to.speed,
          heading: to.heading,
          city: to.city,
          country: to.country,
        };

        const prev = positionRef.current;
        const latEq =
          prev && Math.abs(prev.latitude - interpolated.latitude) < 1e-7;
        const lonEq =
          prev && Math.abs(prev.longitude - interpolated.longitude) < 1e-7;
        const speedEq =
          prev &&
          (prev.speed === interpolated.speed ||
            (prev.speed == null && interpolated.speed == null));

        if (!prev || !latEq || !lonEq || !speedEq) {
          setPosition(interpolated);
        }

        if (t < 1) {
          animRef.current = requestAnimationFrame(step);
        } else {
          animRef.current = null;
        }
      };
      animRef.current = requestAnimationFrame(step);
    },
    [],
  );

  const doRefresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("permission denied");
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const { coords } = pos;
      const rev = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      const first = rev && rev[0] ? rev[0] : null;
      const city = first?.city || first?.region || first?.subregion || null;
      const country = first?.country || null;
      const now = Date.now();
      const newPos: Position = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed: coords.speed,
        heading: coords.heading,
        city,
        country,
      };
      lastRawRef.current = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed: coords.speed,
        heading: coords.heading,
        timestamp: now,
      };
      if (positionRef.current) {
        animateTo(positionRef.current, newPos, 300);
      } else {
        setPosition(newPos);
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [animateTo]);

  const positionRef = React.useRef<Position | null>(null);
  React.useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const startWatching = React.useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("permission denied");
        return;
      }
      if (subscriberRef.current) return;

      subscriberRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 5,
          timeInterval: 1000,
        },
        (pos) => {
          const { latitude, longitude, speed, heading } = pos.coords;
          const timestamp = pos.timestamp || Date.now();
          const newRaw = { latitude, longitude, speed, heading, timestamp };
          const prevRaw = lastRawRef.current;
          lastRawRef.current = newRaw;

          const newPos: Position = {
            latitude,
            longitude,
            speed,
            heading,
            city: positionRef.current?.city || null,
            country: positionRef.current?.country || null,
          };

          if (!prevRaw || !positionRef.current) {
            setPosition(newPos);
            return;
          }

          const dt = (timestamp - prevRaw.timestamp) / 1000;
          const dur = Math.max(300, Math.min(1500, dt * 1000));
          animateTo(positionRef.current!, newPos, dur);
        },
      );
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }, [animateTo]);

  const stopWatching = React.useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (subscriberRef.current) {
      try {
        if (typeof subscriberRef.current.remove === "function") {
          subscriberRef.current.remove();
        }
      } catch (e) {
        console.warn("[PositionContext] Failed to remove subscription:", e);
      }
      subscriberRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const lastKnown = await Location.getLastKnownPositionAsync({});
          if (lastKnown && active && !positionRef.current) {
            setPosition({
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
              speed: lastKnown.coords.speed,
              heading: lastKnown.coords.heading,
              city: null,
              country: null,
            });
          }
        }
      } catch {}
    })();

    startWatching();
    doRefresh();

    return () => {
      active = false;
      stopWatching();
    };
  }, []);

  const value = React.useMemo(
    () => ({
      position,
      loading,
      error,
      refresh: doRefresh,
      startWatching,
      stopWatching,
      setInterpolationEnabled,
    }),
    [position, loading, error, doRefresh, startWatching, stopWatching, setInterpolationEnabled],
  );

  return (
    <PositionContext.Provider value={value}>
      {children}
    </PositionContext.Provider>
  );
}

export default PositionContext;
