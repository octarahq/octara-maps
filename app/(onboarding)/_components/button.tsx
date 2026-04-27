import { HapticTouchable } from "@/components/HapticTouchable";
import { Colors } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { cn } from "@/utils/cn";
import * as Haptics from "expo-haptics";
import type { TouchableOpacityProps } from "react-native";
import { Text, Vibration } from "react-native";

export type OnboardingButtonProps = TouchableOpacityProps & {
  title: string;
};

export default function OnboardingButton({
  title,
  style,
  className,
  onPress,
  disabled,
  ...rest
}: OnboardingButtonProps) {
  const isDisabled = !!disabled;
  const background = isDisabled ? "#374151" : Colors.dark.primary;
  const color = useThemeColor({ dark: Colors.dark.text }, "text");

  const handlePress: TouchableOpacityProps["onPress"] = (e) => {
    if (isDisabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {
          Vibration.vibrate(50);
        },
      );
      return;
    }
    onPress?.(e);
  };

  return (
    <HapticTouchable
      className={cn(
        "flex-1 h-[56px] rounded-[28px] items-center justify-center",
        className,
        isDisabled ? "bg-gray-700" : "bg-primary",
        "shadow",
      )}
      onPress={handlePress}
      {...rest}
    >
      <Text
        className="text-[18px] font-bold"
        style={{ color }}
        numberOfLines={1}
      >
        {title}
      </Text>
    </HapticTouchable>
  );
}
