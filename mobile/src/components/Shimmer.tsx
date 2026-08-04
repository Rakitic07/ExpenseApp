import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, font, radius } from '../theme';

let gid = 0;
const nextId = () => `shimmer_${++gid}`;

/**
 * Cursor-style shimmering label — a soft light band sweeps across muted text to
 * signal a "working…" state (mirrors the web `.shimmer-text`). Uses the native
 * driver for the sweep so it stays smooth even on low-end phones.
 */
export function ShimmerText({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const x = useRef(new Animated.Value(0)).current;
  const id = useMemo(nextId, []);
  const band = Math.max(48, size.w * 0.55);

  useEffect(() => {
    if (size.w === 0) return;
    const anim = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [size.w, x]);

  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-band, size.w],
  });

  return (
    <View
      style={styles.clip}
      onLayout={e =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }>
      <Text style={[styles.baseText, style]}>{children}</Text>
      {size.w > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: band,
            transform: [{ translateX }],
          }}>
          <Svg width={band} height={size.h || 20}>
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.6" />
                <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={band} height={size.h || 20} fill={`url(#${id})`} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

/** A shimmering placeholder block for content that hasn't loaded yet. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const id = useMemo(nextId, []);
  const band = Math.max(60, w * 0.4);

  useEffect(() => {
    if (w === 0) return;
    const anim = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [w, x]);

  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-band, w] });

  return (
    <View
      onLayout={e => setW(e.nativeEvent.layout.width)}
      style={[styles.skeleton, style]}>
      {w > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: band,
            transform: [{ translateX }],
          }}>
          <Svg width={band} height="100%">
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.14" />
                <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={band} height="100%" fill={`url(#${id})`} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  baseText: { color: colors.textDim, fontSize: font.body, fontWeight: '600' },
  skeleton: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
});
