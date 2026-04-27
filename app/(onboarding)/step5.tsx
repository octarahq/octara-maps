import { HapticTouchable as TouchableOpacity } from "@/components/HapticTouchable";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useUser } from "@/contexts/UserContext";
import { createTranslator } from "@/i18n";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

const { t } = createTranslator("onboarding");

type PrivacyLevel = "total" | "necessary" | "limited" | "none";

export default function Step5() {
  const { privacy, setPrivacy } = useUser();
  const { showWarning, hideWarning } = usePermissions();
  const [level, setLevel] = useState<PrivacyLevel>(privacy);

  useEffect(() => {
    setLevel(privacy);
  }, [privacy]);

  const options: {
    key: PrivacyLevel;
    title: string;
    body: string;
    tag?: string;
  }[] = [
    {
      key: "total",
      title: t("step5.option_total"),
      body: t("step5.option_total_body"),
    },
    {
      key: "necessary",
      title: t("step5.option_necessary"),
      body: t("step5.option_necessary_body"),
    },
    {
      key: "limited",
      title: t("step5.option_limited"),
      body: t("step5.option_limited_body"),
    },
    {
      key: "none",
      title: t("step5.option_none"),
      body: t("step5.option_none_body"),
    },
  ];

  const selectLevel = (opt: PrivacyLevel) => {
    if (opt === "none") {
      showWarning({
        iconName: "warning",
        title: t("step5.option_none"),
        description: t("step5.none_warning"),
        buttons: [
          { label: t("dismiss"), action: hideWarning },
          {
            label: t("next"),
            action: () => {
              setLevel("none");
              setPrivacy("none");
              hideWarning();
            },
          },
        ],
      });
    } else {
      setLevel(opt);
      setPrivacy(opt);
    }
  };

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
          <View className="pt-[100px] pb-6">
            <ThemedText
              type="title"
              className="text-white font-bold text-[36px] leading-[40px] mb-2"
            >
              {t("step5.heading")}
            </ThemedText>
            <ThemedText className="text-white/70 text-[16px] leading-[22px]">
              {t("step5.description")}
            </ThemedText>
          </View>
          <View className="flex-col gap-3 py-4">
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                className="flex-row items-center gap-3 border-2 border-white/10 rounded-[24px] p-4"
                style={[
                  { backgroundColor: Colors.dark.background },
                  level === opt.key && { borderColor: Colors.dark.primary },
                ]}
                activeOpacity={0.8}
                onPress={() => selectLevel(opt.key)}
              >
                <View className="flex-1">
                  <Text className="text-white text-[18px] font-bold">
                    {opt.title}
                  </Text>
                  {opt.tag && (
                    <Text className="text-white text-[10px] font-bold uppercase bg-white/10 px-[6px] py-[2px] rounded-[6px] mt-[2px]">
                      {opt.tag}
                    </Text>
                  )}
                  <Text className="text-white/60 text-[14px] mt-1">
                    {opt.body}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
