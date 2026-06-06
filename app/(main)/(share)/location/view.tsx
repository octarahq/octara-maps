import Header from "@/components/layout/Header";
import MapProvider from "@/components/map";
import { useAuth } from "@/contexts/AuthContext";
import { useLocationSharing } from "@/contexts/LocationSharingContext";
import { createTranslator } from "@/i18n";
import { OctaraService, OctaraUser } from "@/services/OctaraService";
import { cn } from "@/utils/cn";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Text,
    ToastAndroid,
    TouchableOpacity,
    View,
} from "react-native";

export default function ShareLocationViewScreen() {
  const { t } = createTranslator("share_location_view");
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { isLoading, user } = useAuth();

  const {
    isSharing,
    sharingWith,
    viewersData,
    startSharing,
    stopSharing,
    connectToViewer,
    disconnectViewer,
  } = useLocationSharing();

  const [targetUser, setTargetUser] = useState<OctaraUser | null>(null);
  const [fetchingTarget, setFetchingTarget] = useState(true);
  const [sharingInProgress, setSharingInProgress] = useState(false);

  useEffect(() => {}, []);

  useEffect(() => {
    if (!isLoading && !user) {
      ToastAndroid.show(t("login_required"), ToastAndroid.LONG);
      router.push("/");
      return;
    }

    if (!user || !userId) return;

    setFetchingTarget(true);
    connectToViewer(userId);

    OctaraService.fetchTargetedLocationSharingUsers(userId)
      .then((shares) => {
        if (shares && shares.length > 0) {
          const shareFromTarget = shares.find(
            (s: any) => s.whoShare.id === userId,
          );
          if (shareFromTarget) {
            setTargetUser(shareFromTarget.whoShare);
            return;
          }
          const shareToTarget = shares.find((s: any) => s.toWho.id === userId);
          if (shareToTarget) {
            setTargetUser(shareToTarget.toWho);
            return;
          }
        }

        if (userId === user.id) {
          setTargetUser(user);
          return;
        }

        return OctaraService.searchUsers(userId).then((users) => {
          if (users.length > 0) {
            setTargetUser(users[0]);
          } else {
            return OctaraService.fetchNearbyUsers().then((nearby) => {
              const found = nearby.find((u) => u.id === userId);
              if (found) setTargetUser(found);
            });
          }
        });
      })
      .catch(() => {})
      .finally(() => setFetchingTarget(false));

    return () => {
      disconnectViewer();
    };
  }, [user, userId, isLoading]);

  const timeAgo = (timestamp: number) => {
    if (!timestamp) return "...";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return t("just_now", { count: seconds });
    const minutes = Math.floor(seconds / 60);
    return t("minutes_ago", { count: minutes });
  };

  const handleSharePosition = async () => {
    if (!userId || sharingInProgress) return;
    setSharingInProgress(true);
    try {
      await startSharing(userId);
      ToastAndroid.show(t("share_success"), ToastAndroid.SHORT);
    } catch (err) {
      ToastAndroid.show(t("share_failure"), ToastAndroid.SHORT);
    } finally {
      setSharingInProgress(false);
    }
  };

  const handleStopSharing = async () => {
    await stopSharing();
    ToastAndroid.show(t("sharing_stopped"), ToastAndroid.SHORT);
  };

  if (isLoading || (fetchingTarget && !targetUser)) {
    return (
      <View className="flex bg-[#101922] pt-4">
        <Header title={t("title")} />
        <View className="justify-content items-center flex-1">
          <ActivityIndicator size="large" color="#0d7ff2" />
          <Text className="text-[#90adcb]">{t("loading")}</Text>
        </View>
      </View>
    );
  }

  const isMeSharingWithThisUser = isSharing && sharingWith === userId;
  const lastUpdate = viewersData?.timestamp
    ? timeAgo(viewersData.timestamp)
    : null;

  const usersPositions =
    viewersData?.lat && viewersData?.lng
      ? [
          {
            avatar_url: targetUser?.avatar_url || "",
            latitude: viewersData.lat,
            longitude: viewersData.lng,
          },
        ]
      : [];

  const displayName =
    targetUser?.name || targetUser?.email || t("unknown_user");

  return (
    <View className="flex-1 bg-[#101922]">
      <Header title={t("title")} />

      <View className="px-5 py-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-xl font-bold">{displayName}</Text>
          <View
            className={cn(
              "flex-row items-center px-3 py-1 rounded-full",
              viewersData ? "bg-green-500/20" : "bg-red-500/20",
            )}
          >
            <View
              className={cn(
                "w-2 h-2 rounded-full mr-2",
                viewersData ? "bg-green-500" : "bg-red-500",
              )}
            />
            <Text
              className={cn(
                "text-xs font-semibold",
                viewersData ? "text-green-500" : "text-red-500",
              )}
            >
              {viewersData ? t("online") : t("offline")}
            </Text>
          </View>
        </View>

        {lastUpdate && (
          <Text className="text-[#90adcb] text-sm mt-1">
            {t("updated")} {lastUpdate}
          </Text>
        )}
      </View>

      <View className="flex-1 mx-4 mb-4 rounded-2xl overflow-hidden border border-[#2e3a4c] bg-[#1a2533]">
        <MapProvider
          showUserLocation={true}
          showControls={false}
          style={{
            flex: 1,
          }}
          goTo={
            viewersData
              ? { lat: viewersData.lat, lng: viewersData.lng }
              : undefined
          }
          showUsersPosition={
            usersPositions.length > 0 ? usersPositions : undefined
          }
        />
      </View>

      <View className="px-4 pb-8">
        {!isMeSharingWithThisUser ? (
          <TouchableOpacity
            className={cn(
              "h-16 rounded-xl items-center justify-center",
              sharingInProgress ? "bg-blue-500/60" : "bg-blue-500",
            )}
            onPress={handleSharePosition}
            disabled={sharingInProgress}
          >
            {sharingInProgress ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-lg font-bold">
                {t("share_position")}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className="h-16 rounded-xl items-center justify-center bg-red-500"
            onPress={handleStopSharing}
          >
            <Text className="text-white text-lg font-bold">
              {t("stop_sharing")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
