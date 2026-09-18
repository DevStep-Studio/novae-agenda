import { Image } from "expo-image";
import { Text, View } from "react-native";

import { avatar } from "@/constants/design-tokens";

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

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full"
      style={{ width: dimension, height: dimension, backgroundColor: avatar.background }}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={{ width: dimension, height: dimension }} contentFit="cover" />
      ) : (
        <Text style={{ color: avatar.text, fontSize: dimension * 0.32, fontWeight: "600", letterSpacing: 0.5 }}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
