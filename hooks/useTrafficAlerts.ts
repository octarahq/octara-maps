import React, { useCallback, useEffect, useRef } from "react";

const PROXY_BASE = "https://4021.fr1.orionhost.xyz";
const POLL_INTERVAL_MS = 3 * 60 * 1000;
const REMINDER_CHECK_INTERVAL_MS = 30 * 1000;
const REMINDER_THRESHOLD_SECONDS = 30 * 60;
const PASSED_ALERT_DISTANCE_M = 150;

export interface TrafficAlertData {
  ID: string;
  Type: string;
  Severity: string;
  Lat: number;
  Lon: number;
  RoadName: string;
  Description: string;
  CreatedAt: string;
  isReminder?: boolean;
}

interface UseTrafficAlertsOptions {
  enabled: boolean;
  isCarMode: boolean;
  routeNamesInNextHour: string[];
  currentPosition: { latitude: number; longitude: number } | null;
  remainingDurationSeconds: number;
  onAlert: (alert: TrafficAlertData) => void;
  onDismiss: () => void;
  activeAlertId: string | null;
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useTrafficAlerts({
  enabled,
  isCarMode,
  routeNamesInNextHour,
  currentPosition,
  remainingDurationSeconds,
  onAlert,
  onDismiss,
  activeAlertId,
}: UseTrafficAlertsOptions) {
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const reminderSentIdsRef = useRef<Set<string>>(new Set());
  const alertQueueRef = useRef<TrafficAlertData[]>([]);
  const receivedAlertsRef = useRef<Map<string, TrafficAlertData>>(new Map());
  const isShowingAlertRef = useRef(false);
  const activeAlertIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeAlertIdRef.current = activeAlertId;
    isShowingAlertRef.current = activeAlertId !== null;
  }, [activeAlertId]);

  const showNextAlert = useCallback(() => {
    if (alertQueueRef.current.length === 0) {
      isShowingAlertRef.current = false;
      return;
    }
    const next = alertQueueRef.current.shift()!;
    isShowingAlertRef.current = true;
    onAlert(next);
  }, [onAlert]);

  const enqueueAlert = useCallback(
    (alert: TrafficAlertData) => {
      alertQueueRef.current.push(alert);
      if (!isShowingAlertRef.current) {
        showNextAlert();
      }
    },
    [showNextAlert],
  );

  const routeNamesStr = (routeNamesInNextHour || []).join('|');

  const fetchAlerts = useCallback(async () => {
    if (!enabled || !isCarMode) {
      return;
    }

    try {
      const res = await fetch(`${PROXY_BASE}/navigation/traffic/getalert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routes: routeNamesStr.split('|').filter(Boolean) }),
      });

      if (!res.ok) return;

      const alerts: TrafficAlertData[] = await res.json();
      if (!Array.isArray(alerts)) return;

      for (const alert of alerts) {
        receivedAlertsRef.current.set(alert.ID, alert);

        if (!seenAlertIdsRef.current.has(alert.ID)) {
          seenAlertIdsRef.current.add(alert.ID);
          enqueueAlert({ ...alert, isReminder: false });
        }
      }
    } catch (e) {
      console.error("[TrafficAlerts] erreur:", e);
    }
  }, [enabled, isCarMode, routeNamesStr, enqueueAlert]);

  const checkReminders = useCallback(() => {
    if (!enabled || !isCarMode) return;

    for (const [id, alert] of receivedAlertsRef.current.entries()) {
      if (reminderSentIdsRef.current.has(id)) continue;
      if (seenAlertIdsRef.current.has(id) && remainingDurationSeconds <= REMINDER_THRESHOLD_SECONDS) {
        reminderSentIdsRef.current.add(id);
        enqueueAlert({ ...alert, isReminder: true });
      }
    }
  }, [enabled, isCarMode, remainingDurationSeconds, enqueueAlert]);

  useEffect(() => {
    if (!activeAlertId || !currentPosition) return;

    const alert = receivedAlertsRef.current.get(activeAlertId);
    if (!alert) return;

    const dist = calculateDistance(
      currentPosition.latitude,
      currentPosition.longitude,
      alert.Lat,
      alert.Lon,
    );

    if (dist < PASSED_ALERT_DISTANCE_M) {
      console.log(`[TrafficAlerts] Alerte ${activeAlertId} ignorée/fermée car distance (${Math.round(dist)}m) < ${PASSED_ALERT_DISTANCE_M}m`);
      onDismiss();
      setTimeout(() => {
        if (alertQueueRef.current.length > 0) {
          showNextAlert();
        }
      }, 500);
    } else {
    }
  }, [currentPosition, activeAlertId, onDismiss, showNextAlert]);

  useEffect(() => {
    if (!enabled || !isCarMode) return;

    fetchAlerts();
    const pollId = setInterval(fetchAlerts, POLL_INTERVAL_MS);
    return () => clearInterval(pollId);
  }, [enabled, isCarMode, fetchAlerts]);
  useEffect(() => {
    if (!enabled || !isCarMode) return;

    const remId = setInterval(checkReminders, REMINDER_CHECK_INTERVAL_MS);
    return () => clearInterval(remId);
  }, [enabled, isCarMode, checkReminders]);

  const dismissActiveAlert = useCallback(() => {
    onDismiss();
    isShowingAlertRef.current = false;
    setTimeout(() => {
      if (alertQueueRef.current.length > 0) {
        showNextAlert();
      }
    }, 300);
  }, [onDismiss, showNextAlert]);

  const [activeTrafficAlerts, setActiveTrafficAlerts] = React.useState<TrafficAlertData[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTrafficAlerts(Array.from(receivedAlertsRef.current.values()));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return { dismissActiveAlert, activeTrafficAlerts };
}
