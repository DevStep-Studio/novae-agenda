import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { avatar } from "@/constants/design-tokens";
import { resolveImageUrlWithFallback } from "@/lib/api-client";

export interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof avatar.sizes;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

// .avatar / .avatar-{size} / .avatar-initials in dark mode, globals.css:1619-1669.
export function Avatar({ name, photoUrl, size = "md" }: AvatarProps) {
  const dimension = avatar.sizes[size];
  const uris = resolveImageUrlWithFallback(photoUrl);
  const [failedPrimary, setFailedPrimary] = useState(false);
  const [failedFallback, setFailedFallback] = useState(false);

  useEffect(() => {
    setFailedPrimary(false);
    setFailedFallback(false);
  }, [photoUrl]);

  const activeUrl = !failedPrimary
    ? uris.primary
    : !failedFallback
    ? uris.fallback
    : null;

  return (
    <View
      style={{
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: avatar.background,
      }}
    >
      {activeUrl ? (
        <Image
          source={{ uri: activeUrl }}
          style={{ width: dimension, height: dimension }}
          contentFit="cover"
          onError={() => {
            if (!failedPrimary && uris.fallback && uris.fallback !== uris.primary) {
              setFailedPrimary(true);
            } else {
              setFailedFallback(true);
            }
          }}
        />
      ) : (
        <Text style={{ color: avatar.text, fontSize: dimension * 0.32, fontWeight: "600", letterSpacing: 0.5 }}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
