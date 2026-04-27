import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { createTranslator } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { ScrollView, View } from "react-native";

const { t } = createTranslator("onboarding");

export default function Step2() {
  return (
    <ThemedView
      className="flex-1"
      style={{ backgroundColor: Colors.dark.background }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-start" }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pb-[100px]">
          <View className="px-6 pt-[100px] pb-4">
            <ThemedText
              type="title"
              className="text-white font-bold text-[32px] text-left mb-4"
            >
              {t("step2.efficiency")}{" "}
              <ThemedText className="text-primary font-bold text-[32px]">
                {t("step2.redefined")}
              </ThemedText>
            </ThemedText>
          </View>

          <View className="flex-1 p-6 gap-4">
            {[
              {
                icon: "navigation",
                title: t("step2.feature1_title"),
                body: t("step2.feature1_body"),
              },
              {
                icon: "local-parking",
                title: t("step2.feature2_title"),
                body: t("step2.feature2_body"),
              },
              {
                icon: "train",
                title: t("step2.feature3_title"),
                body: t("step2.feature3_body"),
              },
            ].map((feat, idx) => (
              <View
                key={idx}
                className="flex-row items-start gap-4 p-4 rounded-[16px] border border-white/10 bg-white/5"
              >
                <View className="w-[56px] h-[56px] rounded-full bg-primary/10 items-center justify-center">
                  <MaterialIcons
                    name={feat.icon as any}
                    size={24}
                    color={Colors.dark.primary}
                  />
                </View>
                <View className="flex-1 justify-center">
                  <ThemedText className="text-white text-[18px] font-bold mb-1">
                    {feat.title}
                  </ThemedText>
                  <ThemedText className="text-white/60 text-[14px]">
                    {feat.body}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
