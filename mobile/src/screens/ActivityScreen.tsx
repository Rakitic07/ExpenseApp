import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Search } from 'lucide-react-native';
import { useStore } from '../state/store';
import { usePeriod } from '../state/period';
import { useCurrency } from '../lib/currency';
import { ExpenseRow } from '../components/ExpenseRow';
import { PeriodBar } from '../components/PeriodBar';
import { categoryColor } from '../lib/categories';
import { filterByPeriod } from '../lib/analytics';
import { colors, font, radius, spacing } from '../theme';
import type { RootStackParamList } from '../navigation';
import type { Expense } from '../lib/types';

export function ActivityScreen() {
  const { expenses } = useStore();
  const { view, year, month, day } = usePeriod();
  const { format } = useCurrency();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('');

  const scoped = useMemo(
    () => filterByPeriod(expenses, view, year, month, day),
    [expenses, view, year, month, day],
  );

  // Categories actually present in the period, so chips stay relevant.
  const categories = useMemo(() => {
    const s = new Set(scoped.map(e => e.category));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [scoped]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter(e => {
      if (catFilter && e.category !== catFilter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.paidBy.toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q) ||
        (e.paymentMode ?? '').toLowerCase().includes(q) ||
        (e.paymentDetail ?? '').toLowerCase().includes(q)
      );
    });
  }, [scoped, query, catFilter]);

  const total = useMemo(() => filtered.reduce((a, e) => a + e.amount, 0), [filtered]);

  const renderItem = ({ item }: { item: Expense }) => (
    <ExpenseRow e={item} onPress={ex => nav.navigate('ExpenseForm', { expense: ex })} />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.count}>
          {filtered.length} · {format(total)}
        </Text>
      </View>
      <View style={styles.periodWrap}>
        <PeriodBar />
      </View>
      <View style={styles.searchWrap}>
        <Search size={18} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search title, category, payer…"
          placeholderTextColor={colors.textFaint}
          style={styles.search}
        />
      </View>

      {categories.length > 0 && (
        <View style={styles.chipsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}>
            <CategoryChip
              label="All"
              active={catFilter === ''}
              onPress={() => setCatFilter('')}
            />
            {categories.map(c => (
              <CategoryChip
                key={c}
                label={c}
                color={categoryColor(c)}
                active={catFilter === c}
                onPress={() => setCatFilter(catFilter === c ? '' : c)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={e => e.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        removeClippedSubviews
        ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
      />
    </SafeAreaView>
  );
}

function CategoryChip({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
      style={[styles.chip, active && styles.chipActive]}>
      {color ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  periodWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  chipsWrap: { marginBottom: spacing.sm },
  chipsRow: { paddingHorizontal: spacing.lg, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: colors.textDim, fontSize: font.small, fontWeight: '600' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  count: { color: colors.textDim, fontSize: font.small, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  search: { flex: 1, color: colors.text, fontSize: font.body },
  list: { paddingHorizontal: spacing.md, paddingBottom: 120 },
  empty: { color: colors.textFaint, textAlign: 'center', padding: spacing.xl },
});
