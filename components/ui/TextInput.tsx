import { Colors } from "@/constants/theme";
import { useHapticSettings } from "@/contexts/HapticSettingsContext";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
  Platform,
  TextInput as RNTextInput,
  TextInputProps,
  Vibration,
} from "react-native";

export type TextFieldProps = TextInputProps & {
  placeholder?: string;
};

export function TextField({ style, placeholder, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const { vibration } = useHapticSettings();
  const enabled = vibration.force > 0;
  const impactStyle =
    vibration.force >= 3
      ? Haptics.ImpactFeedbackStyle.Heavy
      : vibration.force === 2
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
  const duration = vibration.duration;

  return (
    <RNTextInput
      onFocus={() => {
        setFocused(true);
        if (enabled) {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(impactStyle).catch(() => {
              Vibration.vibrate(duration);
            });
          } else {
            Vibration.vibrate(duration);
          }
        }
      }}
      onBlur={() => setFocused(false)}
      className="h-16 rounded-2xl px-6 text-[18px] font-medium bg-[#1e293b] text-white"
      style={[
        focused ? { borderWidth: 2, borderColor: Colors.dark.primary } : { borderWidth: 0 },
        style
      ]}
      placeholder={placeholder}
      placeholderTextColor="rgba(255,255,255,0.5)"
      {...rest}
    />
  );
}

