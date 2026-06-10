import { setLanguage as setI18nLanguage } from "@/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserProfile = {
  name: string;
  language: string;
  hasFinishedOnboarding: boolean;
  settings: {
    favTransportMode: "car" | "transit" | "bike" | "walk";
    voice: "alert" | "all" | "off";
    mapStyle?:
      | "satelite"
      | "terrain"
      | "terrain_dark";
    joinBetaProgram?: boolean;
  };
};

export type SavedPlace = {
  id?: string;
  address: string;
  lat: number;
  lng: number;
  name?: string;
  icon?: string;
};

export type SavedPlaces = {
  home?: SavedPlace | null;
  work?: SavedPlace | null;
  other: SavedPlace[];
};

type ContextType = UserProfile & {
  setName: (name: string) => void;
  setLanguage: (lang: string) => void;
  setHasFinishedOnboarding: (val: boolean) => void;
  isLoading: boolean;
  saved: SavedPlaces;
  setSavedPlace: (key: "home" | "work", place: SavedPlace | null) => void;
  addOtherPlace: (place: SavedPlace) => void;
  removeOtherPlace: (index: number) => void;
  setSettings: (p: UserProfile["settings"]) => void;
};

const STORAGE_KEY = "userProfile";

const UserContext = createContext<ContextType | undefined>(undefined);

function loadProfile(): Promise<UserProfile & { saved?: SavedPlaces }> {
  return AsyncStorage.getItem(STORAGE_KEY).then((v) => {
    if (v) {
      try {
        return JSON.parse(v) as UserProfile;
      } catch {}
    }
    return {
      name: "",
      language: "fr",
      hasFinishedOnboarding: false,
      settings: {
        favTransportMode: "car",
        voice: "alert",
        mapStyle: "satelite",
        joinBetaProgram: false,
      },
    };
  });
}

function saveProfile(profile: UserProfile & { saved?: SavedPlaces }) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile)).catch(() => {});
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    language: Localization.getLocales()[0]?.languageCode || "en",
    hasFinishedOnboarding: false,
    settings: {
      favTransportMode: "car",
      voice: "alert",
      mapStyle: "satelite",
      joinBetaProgram: false,
    },
  });
  const [saved, setSaved] = useState<SavedPlaces>({
    home: null,
    work: null,
    other: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile().then(async (p) => {
      if (!p.language) {
        p.language = Localization.getLocales()[0]?.languageCode || "en";
      }
      await setI18nLanguage(p.language);
      setProfile({
        name: p.name || "",
        language:
          p.language || Localization.getLocales()[0]?.languageCode || "en",
        hasFinishedOnboarding: !!p.hasFinishedOnboarding,
        settings: {
          favTransportMode: p.settings?.favTransportMode || "car",
          voice: p.settings?.voice || "alert",
          mapStyle: p.settings?.mapStyle || "satelite",
          joinBetaProgram: !!p.settings?.joinBetaProgram,
        },
      });
      if ((p as any).saved) {
        setSaved((p as any).saved as SavedPlaces);
      }
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (profile.language) {
      setI18nLanguage(profile.language);
    }
  }, [profile.language]);

  const setSettings = React.useCallback((settings: UserProfile["settings"]) => {
    setProfile((p) => {
      const updated = { ...p, settings };
      saveProfile(updated);
      return updated;
    });
  }, []);

  const setName = React.useCallback((name: string) => {
    setProfile((p) => {
      const updated = { ...p, name };
      saveProfile(updated);
      return updated;
    });
  }, []);

  const setLanguage = React.useCallback((lang: string) => {
    setProfile((p) => {
      const updated = { ...p, language: lang };
      saveProfile(updated);
      return updated;
    });
  }, []);

  const setHasFinishedOnboarding = React.useCallback(
    (val: boolean) => {
      setProfile((p) => {
        const updated = { ...p, hasFinishedOnboarding: val };
        saveProfile({ ...updated, saved });
        return updated;
      });
    },
    [saved],
  );

  const setSavedPlace = React.useCallback(
    (key: "home" | "work", place: SavedPlace | null) => {
      setSaved((s) => {
        const updated = { ...s, [key]: place };
        saveProfile({ ...profile, saved: updated });
        return updated;
      });
    },
    [profile],
  );

  const addOtherPlace = React.useCallback(
    (place: SavedPlace) => {
      setSaved((s) => {
        const updated = { ...s, other: [...s.other, place] };
        saveProfile({ ...profile, saved: updated });
        return updated;
      });
    },
    [profile],
  );

  const removeOtherPlace = React.useCallback(
    (index: number) => {
      setSaved((s) => {
        const updated = {
          ...s,
          other: s.other.filter((_, i) => i !== index),
        };
        saveProfile({ ...profile, saved: updated });
        return updated;
      });
    },
    [profile],
  );

  useEffect(() => {
    if (profile.language) {
      import("@/i18n").then(({ setLanguage }) => {
        setLanguage(profile.language);
      });
    }
  }, [profile.language]);

  return (
    <UserContext.Provider
      value={{
        ...profile,
        saved,
        setSavedPlace,
        addOtherPlace,
        removeOtherPlace,
        setName,
        setLanguage,
        setHasFinishedOnboarding,
        setSettings,
        isLoading,
      }}
    >
      <React.Fragment key={profile.language || "__init__"}>
        {children}
      </React.Fragment>
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}
