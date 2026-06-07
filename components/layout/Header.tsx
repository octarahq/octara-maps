import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StatusBar, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";

export default function Header({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight) + 16;

  return (
    <View className="bg-[#101922]" style={{ paddingTop: topInset }}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <View className="w-full flex-row items-center gap-4">
        <Pressable
          onPress={() => {
            router.back();
          }}
          className="p-2"
        >
          <MaterialIcons name="arrow-back" size={24} color="#0d7ff2" />
        </Pressable>
        <Text className="text-white text-[24px] font-bold mb-2">{title}</Text>
      </View>
    </View>
  );
}
