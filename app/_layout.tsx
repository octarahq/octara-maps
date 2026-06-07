import { AppLogoIcon } from "@/assets/icons";
import { Colors } from "@/constants/theme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import Constants from "expo-constants";
import { useKeepAwake } from "expo-keep-awake";
import * as NavigationBar from "expo-navigation-bar";
import * as Notifications from "expo-notifications";
import { Slot, usePathname, useRouter } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { StatusBar as NativeStatusBar, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import "../global.css";

import { AuthProvider } from "../contexts/AuthContext";
import { HapticSettingsProvider } from "../contexts/HapticSettingsContext";
import { LocationSharingProvider } from "../contexts/LocationSharingContext";
import { PermissionsProvider } from "../contexts/PermissionsContext";
import { UserProvider, useUser } from "../contexts/UserContext";

import ErrorBoundary from "@/components/ErrorBoundary";
import UpdateDialog from "@/components/UpdateDialog";
import { UpdateProvider } from "@/contexts/UpdateContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const unstable_settings = {};

export default function RootLayout() {
  useEffect(() => {
    try {
      require("@/services/LocationTask");
    } catch (e) {
      console.warn("[RootLayout] Could not register LocationTask:", e);
    }
  }, []);

  return (
    <ErrorBoundary>
      <PermissionsProvider>
        <HapticSettingsProvider>
          <UserProvider>
            <AuthProvider>
              <LocationSharingProvider>
                <UpdateProvider>
                  <InnerLayout />
                </UpdateProvider>
              </LocationSharingProvider>
            </AuthProvider>
          </UserProvider>
        </HapticSettingsProvider>
      </PermissionsProvider>
    </ErrorBoundary>
  );
}

function SplashScreenOverlay() {
  return (
    <View className="absolute inset-0 bg-[#070b10] justify-center items-center z-[9999]">
      <View className="items-center justify-center">
        <AppLogoIcon width={60} height={60} />
      </View>
    </View>
  );
}

function InnerLayout() {
  useKeepAwake();

  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const { hasFinishedOnboarding, isLoading } = useUser();
  const [showSplash, setShowSplash] = useState(true);
  const [navigationDone, setNavigationDone] = useState(false);
  const isMainRoute = pathname.startsWith("/(main)");
  const { privacy } = useUser();

  useEffect(() => {
    if (!isLoading && hasFinishedOnboarding) {
      try {
      } catch {}
    }
  }, [isLoading, hasFinishedOnboarding, privacy]);

  useEffect(() => {
    if (Platform.OS === "web" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/service-worker.js")
          .then((reg) => console.log("Service worker registered:", reg))
          .catch((err) =>
            console.log("Service worker registration failed:", err),
          );
      });
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const alwaysShowOnboarding =
      process.env.EXPO_PUBLIC_SHOW_ONBOARDING_ALWAYS === "true";

    if (alwaysShowOnboarding) {
      if (!pathname.startsWith("/(onboarding)")) {
        router.replace("/(onboarding)/step1");
        setNavigationDone(true);
      }
      return;
    }

    if (hasFinishedOnboarding) {
      if (pathname.startsWith("/(onboarding)")) {
        router.replace("/(main)");
        setNavigationDone(true);
      }

      setNavigationDone(true);
      return;
    }

    const isOnboardingStep = [
      "/step1",
      "/step2",
      "/step3",
      "/step4",
      "/step5",
      "/redirect",
    ].some((step) => pathname.includes(step));

    if (!isOnboardingStep) {
      router.replace("/(onboarding)/step1");
      setNavigationDone(true);
    } else {
      setNavigationDone(true);
    }
  }, [hasFinishedOnboarding, pathname, router, isLoading]);

  useEffect(() => {
    if (!isLoading && navigationDone) {
      setTimeout(() => setShowSplash(false), 300);
    }
  }, [isLoading, navigationDone]);

  useEffect(() => {
    const bgColor =
      colorScheme === "dark"
        ? Colors.dark.backgroundDark
        : Colors.light.backgroundLight;

    SystemUI.setBackgroundColorAsync(bgColor).catch(() => {});

    if (Platform.OS !== "web") {
      NativeStatusBar.setHidden(true, "none");
    }

    if (Platform.OS === "android") {
      const edgeToEdgeEnabled = Boolean(
        Constants.expoConfig &&
          Constants.expoConfig.android &&
          Constants.expoConfig.android.edgeToEdgeEnabled
      );

      NativeStatusBar.setTranslucent(true);
      NativeStatusBar.setBackgroundColor("transparent", true);
      if (!edgeToEdgeEnabled) {
        NavigationBar.setPositionAsync("absolute").catch(() => {});
        NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => {});
        NavigationBar.setVisibilityAsync("hidden").catch(() => {});
        NavigationBar.setBackgroundColorAsync(bgColor).catch(() => {});
        NavigationBar.setButtonStyleAsync(
          colorScheme === "dark" ? "light" : "dark",
        ).catch(() => {});
      }
    }
  }, [colorScheme, pathname]);

  const currentBgColor = Colors.dark.backgroundDark;

  return (
    <>
      <Head>
        <title>Octara Maps</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="theme-color" content={currentBgColor} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/android-icon-foreground.png" />
      </Head>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <View
            className="flex-1"
            style={{
              backgroundColor:
                colorScheme === "dark"
                  ? Colors.dark.backgroundDark
                  : Colors.light.backgroundLight,
            }}
          >
            <View className="flex-1">
              <Slot />
            </View>
          </View>
          <StatusBar
            style={colorScheme === "dark" ? "light" : "dark"}
            translucent
          />
        </ThemeProvider>
        <UpdateDialog />
      </GestureHandlerRootView>
      {showSplash && <SplashScreenOverlay />}
    </>
  );
}
