import { HapticTouchable as TouchableOpacity } from "@/components/HapticTouchable";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { TextField } from "@/components/ui/TextInput";
import { Colors } from "@/constants/theme";
import { useUser } from "@/contexts/UserContext";
import { createTranslator } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

const { t } = createTranslator("onboarding");

export default function Step3() {
  const { name: storedName, setName } = useUser();

  const [anon, setAnon] = useState(false);
  const [pressedAnon, setPressedAnon] = useState(false);
  const [localName, setLocalName] = useState("");

  const toggleAnon = () => {
    setAnon((v) => !v);
    if (!anon) {
      setLocalName("");
    }
  };

  useEffect(() => {
    if (storedName) {
      if (storedName === t("step3.traveler")) {
        setAnon(true);
        setLocalName("");
      } else {
        setAnon(false);
        setLocalName(storedName);
      }
    }
  }, [storedName]);

  useEffect(() => {
    if (anon) {
      const val = t("step3.traveler");
      if (val !== storedName) {
        setName(val);
      }
    } else {
      if (localName !== storedName) {
        setName(localName);
      }
    }
  }, [anon, localName, storedName, setName]);

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
          <View className="pt-[100px] pb-4">
            <ThemedText
              type="title"
              className="text-white font-bold text-[32px] text-left"
            >
              {t("step3.title")}
            </ThemedText>
          </View>

          <View className="mb-6">
            <ThemedText className="text-white/60 text-[16px] text-left">
              {t("step3.body")}
            </ThemedText>
          </View>

          <View className="mb-6">
            <TextField
              placeholder={t("step3.enter_your_name")}
              value={localName}
              editable={!anon}
              onChangeText={(text) => {
                setLocalName(text);
              }}
            />
          </View>
          {(localName || anon) && (
            <View className="mb-4">
              <ThemedText className="text-white text-[16px] italic">
                {t("step3.greeting", {
                  name: anon ? t("step3.traveler") : localName,
                })}
              </ThemedText>
            </View>
          )}

          <TouchableOpacity
            className="mb-6 bg-[#1e293b] p-5 rounded-[16px] border border-transparent flex-row items-center justify-between"
            style={[pressedAnon && { borderColor: Colors.dark.primary + "4D" }]}
            activeOpacity={0.75}
            onPress={toggleAnon}
            onPressIn={() => setPressedAnon(true)}
            onPressOut={() => setPressedAnon(false)}
          >
            <View className="flex-row items-center">
              <View
                className="w-6 h-6 rounded-full border-2 border-[#475569] mr-3 bg-transparent"
                style={[
                  anon && {
                    backgroundColor: Colors.dark.primary,
                    borderColor: Colors.dark.primary,
                  },
                ]}
              />
              <Text className="text-[16px] font-medium text-white">
                {t("step3.stay_anonymously")}
              </Text>
            </View>
            <MaterialIcons
              name={!anon ? "visibility" : "visibility-off"}
              size={24}
              color={pressedAnon ? Colors.dark.primary : Colors.dark.icon}
              className="w-6 h-6"
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
