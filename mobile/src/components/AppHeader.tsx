import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { RefreshCw, LogOut, Check } from 'lucide-react-native';
import { useStore } from '../state/store';
import { CURRENCIES, useCurrency } from '../lib/currency';
import { colors, font, radius, spacing } from '../theme';

export function AppHeader({ title }: { title: string }) {
  const { online, syncing, refresh, logout } = useStore();
  const { currency, setCurrency } = useCurrency();
  const [picker, setPicker] = useState(false);

  const dot = syncing ? colors.amber : online ? colors.green : colors.red;

  return (
    <View style={styles.wrap}>
      <View>
        <Text style={styles.brand}>Spendly+</Text>
        <Text style={styles.sub}>{title}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => setPicker(true)} style={styles.chip}>
          <Text style={styles.chipText}>{currency.code}</Text>
        </Pressable>
        <Pressable onPress={refresh} hitSlop={8} style={styles.iconBtn}>
          <View style={[styles.syncDot, { backgroundColor: dot }]} />
          <RefreshCw size={16} color={colors.textDim} />
        </Pressable>
        <Pressable onPress={logout} hitSlop={8} style={styles.iconBtn}>
          <LogOut size={18} color={colors.textDim} />
        </Pressable>
      </View>

      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Currency</Text>
            {CURRENCIES.map(c => (
              <Pressable
                key={c.code}
                onPress={() => {
                  setCurrency(c.code);
                  setPicker(false);
                }}
                style={styles.currRow}>
                <Text style={styles.currText}>
                  {c.symbol}  {c.label}
                </Text>
                {currency.code === c.code ? <Check size={18} color={colors.green} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  brand: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  sub: { color: colors.textFaint, fontSize: font.tiny },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { color: colors.text, fontWeight: '700', fontSize: font.small },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetTitle: { color: colors.text, fontSize: font.h3, fontWeight: '800', marginBottom: spacing.md },
  currRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  currText: { color: colors.text, fontSize: font.body },
});
