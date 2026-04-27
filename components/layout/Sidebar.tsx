import {
  AvatarIcon,
  BookmarkIcon,
  CloseIcon,
  HistoryIcon,
  LogoutIcon,
  SettingsIcon,
} from "@/assets/icons";
import { AvatarImg } from "@/components/AvatarImg";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import React from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { SlideInLeft, SlideOutLeft } from "react-native-reanimated";

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
}

export function Sidebar({ isVisible, onClose }: SidebarProps) {
  const { user, logout, login } = useAuth();
  const router = useRouter();

  if (!isVisible) return null;

  const handleNavigation = (path: string) => {
    onClose();
    router.push(path as any);
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const handleLogin = async () => {
    await login();
    onClose();
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "Guest";

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View className="absolute inset-0">
        <Pressable className="absolute inset-0" onPress={onClose} />

        <Animated.View
          entering={SlideInLeft.duration(300)}
          exiting={SlideOutLeft.duration(300)}
          className="w-80 h-full bg-[#101922] rounded-r-[40px] shadow-[10px_0_15px_rgba(0,0,0,0.5)] elevation-20"
        >
          <SafeAreaView className="flex-1">
            <View className="p-5 items-end">
              <TouchableOpacity onPress={onClose} className="p-2">
                <CloseIcon
                  width={24}
                  height={24}
                  color="rgba(255,255,255,0.5)"
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View className="px-6 mb-10">
                <AvatarImg size={64} />
                <Text className="text-white text-[20px] font-bold tracking-tighter">
                  {displayName}
                </Text>
                <Text className="text-white/60 text-[12px] mt-1">
                  {user?.email || "Connectez-vous pour plus de fonctionnalités"}
                </Text>
              </View>

              <View className="px-4 gap-2">
                <TouchableOpacity
                  className="flex-row items-center px-4 py-3.5 rounded-[16px] gap-4"
                  onPress={() => handleNavigation("/(main)/settings")}
                >
                  <SettingsIcon
                    width={24}
                    height={24}
                    color="rgba(255,255,255,0.6)"
                  />
                  <Text className="text-white/60 text-[14px] font-medium">
                    Paramètres
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center px-4 py-3.5 rounded-[16px] gap-4"
                  onPress={() => {
                    onClose();
                    router.push("/(main)/trip_history");
                  }}
                >
                  <HistoryIcon
                    width={24}
                    height={24}
                    color="rgba(255,255,255,0.6)"
                  />
                  <Text className="text-white/60 text-[14px] font-medium">
                    Historique des trajets
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center px-4 py-3.5 rounded-[16px] gap-4"
                  onPress={() => {
                    onClose();
                    router.push("/(main)/(search)/search?tab=saved");
                  }}
                >
                  <BookmarkIcon
                    width={24}
                    height={24}
                    color="rgba(255,255,255,0.6)"
                  />
                  <Text className="text-white/60 text-[14px] font-medium">
                    Lieux enregistrés
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View className="p-6 border-t border-white/[0.05] mt-auto">
              <TouchableOpacity
                className="flex-row items-center gap-4 py-3 rounded-[16px]"
                onPress={user?.email ? handleLogout : handleLogin}
              >
                {user?.email ? (
                  <LogoutIcon width={24} height={24} color="#ff6b6b" />
                ) : (
                  <AvatarIcon width={24} height={24} color="#0d7ff2" />
                )}
                <Text
                  className="text-[14px] font-bold"
                  style={{ color: user?.email ? "#ff6b6b" : "#0d7ff2" }}
                >
                  {user?.email ? "Déconnexion" : "Se connecter"}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}
