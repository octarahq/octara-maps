import { HapticTouchable as TouchableOpacity } from "@/components/HapticTouchable";
import { Colors } from "@/constants/theme";
import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Animated, Easing, Text, View, ScrollView } from "react-native";

export type WarningButton = {
  label: string;
  action: () => void;
};

export type WarningMessageProps = {
  visible: boolean;
  onDismiss?: () => void;
  iconName?: string;
  title: string;
  description: string;
  buttons?: WarningButton[];
};

export function WarningMessage({
  visible,
  onDismiss,
  iconName = "warning",
  title,
  description,
  buttons = [],
}: WarningMessageProps) {
  const translateY = React.useRef(new Animated.Value(200)).current;
  const [localVisible, setLocalVisible] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setLocalVisible(true);
    }
    const config = visible
      ? {
          duration: 200,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        }
      : {
          duration: 150,
          easing: Easing.bezier(0, 0, 0.2, 1),
        };

    Animated.timing(translateY, {
      toValue: visible ? 0 : 200,
      ...config,
      useNativeDriver: true,
    }).start(() => {
      if (!visible) {
        setLocalVisible(false);
      }
    });
  }, [visible, translateY]);

  if (!localVisible) return null;

  return (
    <Animated.View className="absolute inset-0 z-[9999] justify-end" style={{ transform: [{ translateY }] }}>
      <TouchableOpacity
        className="absolute inset-0 bg-transparent"
        activeOpacity={1}
        onPress={() => {
          if (buttons && buttons.length > 0) {
            buttons[0].action();
          } else {
            onDismiss?.();
          }
        }}
      />
      <View className="items-center pb-8 justify-end">
        <View className="border border-white/10 rounded-3xl shadow-lg overflow-hidden w-[480px] max-w-full" style={{ backgroundColor: Colors.dark.background }}>
          <View className="h-6 justify-center items-center">
            <View className="h-1 w-10 rounded-full bg-white/20" />
          </View>
          <View className="px-6 py-4 items-center">
            <View className="mb-4 h-16 w-16 rounded-2xl border justify-center items-center" style={{ backgroundColor: Colors.dark.primary + "1A", borderColor: Colors.dark.primary + "33" }}>
              <MaterialIcons
                name={iconName as any}
                size={32}
                color={Colors.dark.primary}
              />
            </View>
            <Text className="text-[24px] font-bold text-center mb-2" style={{ color: Colors.dark.text }}>{title}</Text>
            <View className="items-center py-3 w-full" style={{ maxHeight: 250 }}>
              <ScrollView showsVerticalScrollIndicator={true} className="w-full">
                <Text className="text-white/70 text-base text-center">{description}</Text>
              </ScrollView>
            </View>
            {buttons.length > 0 && (
              <View className="w-full flex-col gap-3 py-4">
                {buttons.map((btn, idx) => (
                  <TouchableOpacity
                    key={idx}
                    className={
                      idx === 0 ? "h-14 rounded-xl justify-center items-center" : "h-14 bg-white/5 border border-white/10 rounded-xl justify-center items-center"
                    }
                    style={
                      idx === 0 ? { backgroundColor: Colors.dark.primary } : {}
                    }
                    onPress={btn.action}
                  >
                    <Text
                      className={
                        idx === 0
                          ? "text-white text-[18px] font-bold"
                          : "text-white/80 text-[18px] font-semibold"
                      }
                    >
                      {btn.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

