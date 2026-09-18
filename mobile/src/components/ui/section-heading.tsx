import { Text, View } from "react-native";

import { colors, typography } from "@/constants/design-tokens";

// .section-heading, globals.css:635-637; SectionHeading in app-shell.tsx:244-246.
export function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <View>
      <Text style={{ color: colors.textPrimary, ...typography.sectionTitle }}>{title}</Text>
      {description ? (
        <Text style={{ color: colors.textSecondary, marginTop: 5, ...typography.sectionDescription }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}
