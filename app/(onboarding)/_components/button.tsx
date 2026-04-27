import { HapticTouchable } from "@/components/HapticTouchable";
import { Colors } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import * as Haptics from "expo-haptics";
import type { TouchableOpacityProps } from "react-native";
import { StyleSheet, Text, Vibration } from "react-native";

export type OnboardingButtonProps = TouchableOpacityProps & {
  title: string;
};

export default function OnboardingButton({
  title,
  style,
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
      className="flex-1 h-[56px] rounded-[28px] items-center justify-center"
      style={[
        styles.shadow,
        { backgroundColor: background },
        isDisabled && styles.shadowDisabled,
        style,
      ]}
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

const styles = StyleSheet.create({
  shadow: {
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  shadowDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
});
