import { HapticTouchable as TouchableOpacity } from "@/components/HapticTouchable";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { WarningMessage } from "@/components/WarningMessage";
import { Colors } from "@/constants/theme";
import { createTranslator } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { usePermissions } from "../../contexts/PermissionsContext";

const { t } = createTranslator("onboarding");

export default function Step4() {
  const {
    permissions,
    setPermission,
    warning,
    locationAccuracy,
    setLocationAccuracy,
  } = usePermissions();
  const [pressed, setPressed] = useState({
    location: false,
    notifications: false,
    contacts: false,
  });

  useEffect(() => {
    (async () => {
      const { status, granted } =
        await Location.getForegroundPermissionsAsync();
      if (status === "granted" && granted) {
        setPermission("location", true);
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          if (pos.coords.accuracy && pos.coords.accuracy <= 30) {
            setLocationAccuracy("high");
          } else {
            setLocationAccuracy("low");
          }
        } catch {
          setLocationAccuracy("low");
        }
      }
    })();
  }, [setPermission]);

  const toggle = async (key: keyof typeof permissions) => {
    if (key === "location") {
      if (permissions.location) {
        setPermission("location", false);
        setLocationAccuracy("none");
      } else {
        const { status, granted } =
          await Location.requestForegroundPermissionsAsync();
        if (status === "granted" && granted) {
          try {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            if (pos.coords.accuracy && pos.coords.accuracy <= 30) {
              setLocationAccuracy("high");
            } else {
              setLocationAccuracy("low");
            }
          } catch {
            setLocationAccuracy("low");
          }
          setPermission("location", true);
        } else {
          setPermission("location", false);
          setLocationAccuracy("none");
        }
      }
    } else {
      setPermission(key, !permissions[key]);
    }
  };

  const onPressIn = (key: keyof typeof permissions) => {
    setPressed((p) => ({ ...p, [key]: true }));
  };
  const onPressOut = (key: keyof typeof permissions) => {
    setPressed((p) => ({ ...p, [key]: false }));
  };

  const items: {
    key: keyof typeof permissions;
    icon: string;
    title: string;
    body: string;
  }[] = [
    {
      key: "location",
      icon: "location-on",
      title: t("step4.location_title"),
      body: t("step4.location_body"),
    },
    {
      key: "notifications",
      icon: "notifications",
      title: t("step4.notifications_title"),
      body: t("step4.notifications_body"),
    },
    {
      key: "contacts",
      icon: "contacts",
      title: t("step4.contacts_title"),
      body: t("step4.contacts_body"),
    },
  ];

  return (
    <ThemedView
      className="flex-1"
      style={{ backgroundColor: Colors.dark.background }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-start" }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pb-[100px]">
          <View className="pt-[100px] pb-8">
            <ThemedText
              type="title"
              className="text-white font-bold text-[36px] leading-[40px] mb-2"
            >
              {t("step4.heading")}
            </ThemedText>
            <ThemedText className="text-[#a1a1a1] text-[16px] leading-[22px]">
              {t("step4.description")}
            </ThemedText>
          </View>

          <View className="flex-col gap-4 mb-6">
            {items.map((item) => (
              <TouchableOpacity
                key={item.key}
                className="flex-row items-center gap-4 bg-[#111111] rounded-[24px] p-4 border border-white/5 justify-between min-h-[92px]"
                style={[
                  pressed[item.key] && {
                    borderColor: Colors.dark.primary + "4D",
                  },
                  item.key === "location"
                    ? !permissions.location
                      ? { borderColor: "red", borderWidth: 2 }
                      : locationAccuracy === "low"
                        ? { borderColor: "yellow", borderWidth: 2 }
                        : { borderColor: Colors.dark.primary, borderWidth: 2 }
                    : permissions[item.key]
                      ? { borderColor: Colors.dark.primary, borderWidth: 2 }
                      : undefined,
                ]}
                activeOpacity={0.75}
                onPress={() => toggle(item.key)}
                onPressIn={() => onPressIn(item.key)}
                onPressOut={() => onPressOut(item.key)}
              >
                <View className="flex-row items-center gap-4">
                  <View className="w-[56px] h-[56px] rounded-full bg-primary/10 border border-primary/20 items-center justify-center">
                    <MaterialIcons
                      name={item.icon as any}
                      size={28}
                      color={Colors.dark.primary}
                    />
                  </View>
                  <View className="flex-col justify-center shrink min-w-0">
                    <Text className="text-white text-[18px] font-bold">
                      {item.title}
                    </Text>
                    <Text className="text-[#a1a1a1] text-[14px] mt-1 flex-wrap">
                      {item.body}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      {warning && (
        <WarningMessage
          visible={true}
          iconName={warning.iconName}
          title={warning.title}
          description={warning.description}
          buttons={warning.buttons}
        />
      )}
    </ThemedView>
  );
}
