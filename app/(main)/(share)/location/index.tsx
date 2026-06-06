import { SearchIcon } from "@/assets/icons";
import { AvatarImg } from "@/components/AvatarImg";
import Header from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { createTranslator } from "@/i18n";
import { OctaraService, OctaraUser } from "@/services/OctaraService";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View
} from "react-native";

export default function ShareLocationScreen() {
  const { t } = createTranslator("share_location");
  const { isLoading, user } = useAuth();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<OctaraUser[] | null>(null);
  const [nearbyUsers, setNearbyUsers] = React.useState<OctaraUser[]>([]);
  const [actualySharing, setActualySharing] = React.useState<
    typeof OctaraService.fetchTargetedLocationSharingUsers extends () => Promise<
      infer U
    >
      ? U
      : never
  >([]);
  useEffect(() => {
    /* telemetry removed */;
  }, []);

  useEffect(() => {
    if (!user) {
      ToastAndroid.show(t("login_required"), ToastAndroid.LONG);
      router.push("/");
    } else {
      OctaraService.fetchNearbyUsers()
        .then((users) => {
          setNearbyUsers(users);
        })
        .catch(() => {
          setNearbyUsers([]);
        });
      OctaraService.fetchTargetedLocationSharingUsers()
        .then((users) => {
          setActualySharing(users);
        })
        .catch(() => {
          setActualySharing([]);
        });
    }
  }, [user, t]);

  useEffect(() => {
    if (query.trim() === "") {
      setResults(null);
    } else {
      OctaraService.searchUsers(query)
        .then((users) => {
          setResults(users);
        })
        .catch(() => {
          setResults([]);
        });
    }
  }, [query]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#101922]">
        <Header title={t("title")} />
        <View className="items-center justify-center p-4">
          <ActivityIndicator size="large" color="#e3e3e3" />
          <Text className="text-[#90adcb]">{t("loading")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#101922]">
      <Header title={t("title")} />

      <ScrollView contentContainerClassName="p-4 pb-10">
        <View className="px-1">
          <View className="h-14 rounded-12 bg-[#12202a] flex-row items-center px-3">
            <Text className="text-[#90adcb] mr-2">
              <SearchIcon />
            </Text>
            <TextInput
              placeholder={t("placeholder")}
              placeholderTextColor="#90adcb"
              className="flex-1 text-white text-[16px]"
              value={query}
              onChangeText={setQuery}
            />
          </View>
        </View>
        {actualySharing.length > 0 && (
          <View>
            <Text className="text-[#90adcb]">{t("actually_sharing")}</Text>
            {actualySharing.map((u) => (
              <TouchableOpacity
                key={u.id}
                onPress={() =>
                  router.push({
                    pathname: "/(main)/(share)/location/view",
                    params: {
                      userId:
                        u.whoShare.id === user?.id ? u.toWho.id : u.whoShare.id,
                    },
                  })
                }
              >
                <View className="flex-row items-center mt-3 p-3 rounded-14 border border-[#2e3a4c] bg-[#1a2533]">
                  <View className="w-12 h-12 rounded-24 bg-[#2e3a4c] items-center justify-center mr-4">
                    <AvatarImg id={u.id} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white" numberOfLines={1}>
                      {u.whoShare.name || "Unknown User"} {t("to")}{" "}
                      {u.toWho.name || "Unknown User"}
                    </Text>
                    <Text className="text-[#90adcb]" numberOfLines={1}></Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {!query ? (
          nearbyUsers.length === 0 ? (
            <View className="justify-content items-center flex-1">
              <Text className="text-[#90adcb]">{t("no_nearby")}</Text>
            </View>
          ) : (
            nearbyUsers.map((u) => (
              <TouchableOpacity
                key={u.id}
                onPress={() =>
                  router.push({
                    pathname: "/(main)/(share)/location/view",
                    params: {
                      userId: u.id,
                    },
                  })
                }
              >
                <View className="flex-row items-center mt-3 p-3 rounded-14 border border-[#2e3a4c] bg-[#1a2533]">
                  <View className="w-12 h-12 rounded-24 bg-[#2e3a4c] items-center justify-center mr-4">
                    <AvatarImg src={u.avatar_url} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white" numberOfLines={1}>
                      {u.name || "Unknown User"}
                    </Text>
                    <Text className="text-[#90adcb]" numberOfLines={1}>
                      {u.email}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : results === null ? (
          <View className="justify-content items-center flex-1">
            <ActivityIndicator size="large" color="#e3e3e3" />
            <Text className="text-[#90adcb]">{t("searching")}</Text>
          </View>
        ) : results.length === 0 ? (
          <View className="justify-content items-center flex-1">
            <Text className="text-[#90adcb]">{t("no_results")}</Text>
          </View>
        ) : (
          results.map((u) => (
            <TouchableOpacity
              key={u.id}
              onPress={() =>
                router.push({
                  pathname: "/(main)/(share)/location/view",
                  params: {
                    userId: u.id,
                  },
                })
              }
            >
              <View className="flex-row items-center mt-3 p-3 rounded-14 border border-[#2e3a4c] bg-[#1a2533]">
                <View className="w-12 h-12 rounded-24 bg-[#2e3a4c] items-center justify-center mr-4">
                  <AvatarImg src={u.avatar_url} />
                </View>
                <View className="flex-1">
                  <Text className="text-white" numberOfLines={1}>
                    {u.name || "Unknown User"}
                  </Text>
                  <Text className="text-[#90adcb]" numberOfLines={1}>
                    {u.email}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
