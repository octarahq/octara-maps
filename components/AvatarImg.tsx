import { AvatarIcon } from "@/assets/icons";
import { OctaraService } from "@/services/OctaraService";
import { cn } from "@/utils/cn";
import { Image, ImageStyle } from "expo-image";
import React, { useEffect, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

interface AvatarImgProps {
  size?: number;
  style?: StyleProp<ViewStyle | ImageStyle>;
  classname?: string;
  src?: string | null;
  id?: string;
}

export function AvatarImg({
  size = 40,
  style,
  src,
  id,
  classname,
}: AvatarImgProps) {
  const [token, setToken] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    OctaraService.getAccessToken().then(setToken);
  }, []);

  const avatarUrl =
    src || id
      ? `https://octara.xyz/api/v1/users/${id}/avatar`
      : "https://octara.xyz/api/v1/me/avatar";

  if (!token || hasError) {
    return (
      <View
        className={cn(
          "bg-white/20 items-center justify-center overflow-hidden",
          classname,
          `w-${size}`,
          `h-${size}`,
          `rounded-${size / 2}`,
        )}
      >
        <AvatarIcon width={size * 0.6} height={size * 0.6} color={"#fff"} />
      </View>
    );
  }

  return (
    <Image
      source={{
        uri: avatarUrl,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }}
      className={cn(
        "bg-white/20 items-center justify-center overflow-hidden",
        classname,
        `w-${size}`,
        `h-${size}`,
        `rounded-${size / 2}`,
      )}
      contentFit="cover"
      transition={200}
      onError={() => {
        setHasError(true);
      }}
    />
  );
}
