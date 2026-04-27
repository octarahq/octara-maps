import { HapticTouchable } from "@/components/HapticTouchable";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useUser } from "@/contexts/UserContext";
import { createTranslator, setLanguage as setI18nLanguage } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import HeroIcon from "./_components/hero-icon";

const { t } = createTranslator("onboarding");

export default function Step1() {
  const { language, setLanguage } = useUser();
  const [showMenu, setShowMenu] = useState(false);

  const changeLang = async (lng: string) => {
    await setI18nLanguage(lng);

    setLanguage(lng);
    setShowMenu(false);
  };

  return (
    <ThemedView
      className="flex-1"
      style={{ backgroundColor: Colors.dark.background }}
    >
      <View className="absolute top-0 w-full pt-6 px-4 items-end z-10">
        <View className="relative">
          <HapticTouchable
            className="flex-row items-center gap-[6px] py-[6px] px-[12px] rounded-full bg-white/5 border border-white/10"
            onPress={() => setShowMenu((v: boolean) => !v)}
          >
            <MaterialIcons
              name="language"
              size={18}
              color="white"
              style={{ marginRight: 6 }}
            />
            <ThemedText className="text-white/80 text-[14px]">
              {language === "en" ? t("lang_en") : t("lang_fr")}
            </ThemedText>
            <MaterialIcons
              name={showMenu ? "expand-less" : "expand-more"}
              size={18}
              color="white"
              style={{ marginLeft: 6 }}
            />
          </HapticTouchable>
          {showMenu && (
            <View className="absolute top-full right-0 mt-2 bg-black rounded-[8px] p-2 z-[20]">
              <HapticTouchable onPress={() => changeLang("en")}>
                <ThemedText className="text-white py-1 px-3">
                  {t("lang_en")}
                </ThemedText>
              </HapticTouchable>
              <HapticTouchable onPress={() => changeLang("fr")}>
                <ThemedText className="text-white py-1 px-3">
                  {t("lang_fr")}
                </ThemedText>
              </HapticTouchable>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 items-center justify-center px-8 mt-16 mb-[100px] z-[1]">
          <HeroIcon />

          <View className="max-w-[320px] pb-4">
            <ThemedText
              type="title"
              className="text-white font-bold text-[36px] text-center"
            >
              {t("step1.welcome_title")}
            </ThemedText>
          </View>

          <View className="max-w-[280px] pb-6">
            <ThemedText className="text-white/60 text-[18px] text-center">
              {t("step1.welcome_body")}
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
