import { Image } from "expo-image";
import { useState } from "react";
import { Text, View } from "react-native";

import { avatar } from "@/constants/design-tokens";
import { resolveImageUrl } from "@/lib/api-client";

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
  const resolvedUrl = resolveImageUrl(photoUrl);
  const [loadError, setLoadError] = useState(false);

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
      {resolvedUrl && !loadError ? (
        <Image
          source={{ uri: resolvedUrl }}
          style={{ width: dimension, height: dimension }}
          contentFit="cover"
          onError={() => setLoadError(true)}
        />
      ) : (
        <Text style={{ color: avatar.text, fontSize: dimension * 0.32, fontWeight: "600", letterSpacing: 0.5 }}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
