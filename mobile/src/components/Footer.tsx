import React from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { GITHUB_URL } from '../lib/update';
import { useUpdates } from '../state/updates';
import { colors, font, radius, spacing } from '../theme';

// lucide-react-native dropped its `Github` glyph, so draw the official mark
// ourselves with react-native-svg (already a dependency).
function GithubMark({ size = 15, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12 .5C5.73.5.5 5.73.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.53 11.53 0 0 0 23.5 12.02C23.5 5.73 18.27.5 12 .5Z"
      />
    </Svg>
  );
}

export function Footer() {
  const { checking, check } = useUpdates();

  const onCheck = () => check(true);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onCheck}
        disabled={checking}
        android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
        style={styles.checkBtn}>
        {checking ? (
          <ActivityIndicator size="small" color={colors.textDim} />
        ) : (
          <RefreshCw size={15} color={colors.primary} />
        )}
        <Text style={styles.checkText}>{checking ? 'Checking…' : 'Check for updates'}</Text>
      </Pressable>

      <Pressable
        onPress={() => Linking.openURL(GITHUB_URL)}
        android_ripple={{ color: 'rgba(255,255,255,0.14)' }}
        hitSlop={8}
        style={styles.ghBtn}>
        <GithubMark size={15} color="#fff" />
        <Text style={styles.ghText}>SpendlyPlus</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopColor: colors.sheen,
  },
  checkText: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  // Monochrome GitHub button: solid black with a hairline white border.
  ghBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  ghText: { color: '#fff', fontSize: font.small, fontWeight: '700' },
});
