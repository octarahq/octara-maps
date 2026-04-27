import { Colors } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { View } from "react-native";

export type PageIndicatorsProps = {
  total: number;
  current: number;
};

export default function PageIndicators({
  total,
  current,
}: PageIndicatorsProps) {
  const activeColor = useThemeColor({ dark: Colors.dark.primary }, "text");
  const inactiveColor = "rgba(255,255,255,0.2)";

  return (
    <View className="flex-row items-center justify-center gap-2 py-4">
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          className="h-[6px] rounded-full"
          style={[
            {
              backgroundColor: index === current ? activeColor : inactiveColor,
              width: index === current ? 24 : 6,
            },
          ]}
        />
      ))}
    </View>
  );
}
