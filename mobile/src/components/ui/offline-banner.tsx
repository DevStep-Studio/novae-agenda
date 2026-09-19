import { WifiOff } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function OfflineBanner() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  if (isConnected !== false) return null;

  return (
    <View
      className="w-full flex-row items-center justify-center gap-2 px-4 py-2"
      style={{
        backgroundColor: "#ef4444",
        paddingTop: Math.max(insets.top, 8),
      }}
    >
      <WifiOff size={16} color="#ffffff" />
      <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>
        Sem conexão com a internet. Verifique sua rede.
      </Text>
    </View>
  );
}
