import HeroPattern from "@/assets/icons/HeroPattern";
import { Colors } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { MaterialIcons } from "@expo/vector-icons";
import { View } from "react-native";

export default function HeroIcon() {
  const primary = useThemeColor({ dark: Colors.dark.primary }, "text");
  const bg = "rgba(255,255,255,0.05)";
  const border = "rgba(255,255,255,0.1)";

  return (
    <View className="w-[280px] aspect-square mb-12 items-center justify-center rounded-[24px] overflow-hidden">
      <View className="absolute inset-0 opacity-20 bg-transparent rounded-[24px] overflow-hidden">
        <HeroPattern />
      </View>
      <View
        className="w-full h-full rounded-[24px] border items-center justify-center overflow-hidden"
        style={{ backgroundColor: bg, borderColor: border }}
      >
        <MaterialIcons name="explore" size={120} color={primary} />
        <View
          className="w-[64px] h-1 rounded-full mt-4"
          style={{ backgroundColor: primary }}
        />
      </View>
    </View>
  );
}
