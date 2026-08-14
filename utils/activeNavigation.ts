import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "active_navigation_v1";

export type ActiveNavigationParams = {
  lat: string;
  lng: string;
  mode: string;
  name: string;
  multi?: string;
  ts: number;
};

export async function getActiveNavigation(): Promise<ActiveNavigationParams | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveNavigationParams;
  } catch {
    return null;
  }
}

export async function setActiveNavigation(params: Omit<ActiveNavigationParams, "ts">) {
  try {
    const data: ActiveNavigationParams = { ...params, ts: Date.now() };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export async function clearActiveNavigation() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const c =
    sinDlat * sinDlat +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      sinDlon *
      sinDlon;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

export default { getActiveNavigation, setActiveNavigation, clearActiveNavigation, calculateDistance };
