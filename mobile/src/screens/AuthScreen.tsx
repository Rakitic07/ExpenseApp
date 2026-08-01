import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useStore } from '../state/store';
import { Button, Card, Label } from '../components/ui';
import { colors, font, radius, spacing } from '../theme';

type Mode = 'login' | 'register';

function BrandWordmark() {
  return (
    <Svg width={220} height={44}>
      <Defs>
        <LinearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.primary} />
          <Stop offset="1" stopColor={colors.primary2} />
        </LinearGradient>
      </Defs>
      <SvgText
        x="0"
        y="34"
        fontSize="34"
        fontWeight="800"
        fill="url(#brand)">
        Spendly+
      </SvgText>
    </Svg>
  );
}

export function AuthScreen() {
  const { login, register } = useStore();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState<string | null>(null);

  const submit = async () => {
    setError('');
    const n = name.trim();
    if (n.length < 6) {
      setError('Space name must be at least 6 characters.');
      return;
    }
    if (passphrase.length < 4) {
      setError('Passphrase must be at least 4 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(n, passphrase);
      } else {
        const { recoveryCode } = await register(n, passphrase);
        setRecovery(recoveryCode);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (recovery) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Card strong style={{ width: '100%' }}>
            <Text style={styles.title}>Save your recovery code</Text>
            <Text style={styles.subtle}>
              Keep this safe. It is the only way to reset your passphrase yourself.
            </Text>
            <View style={styles.codeBox}>
              <Text selectable style={styles.code}>
                {recovery}
              </Text>
            </View>
            <Button label="Continue" onPress={() => setRecovery(null)} />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <BrandWordmark />
            <Text style={styles.tagline}>Track spending. Beautifully.</Text>
          </View>

          <Card strong>
            <View style={styles.tabs}>
              {(['login', 'register'] as Mode[]).map(m => (
                <Text
                  key={m}
                  onPress={() => {
                    setMode(m);
                    setError('');
                  }}
                  style={[styles.tab, mode === m && styles.tabActive]}>
                  {m === 'login' ? 'Enter space' : 'Create space'}
                </Text>
              ))}
            </View>

            <Label>Space name</Label>
            <TextInput
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              placeholder="e.g. family-budget"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />

            <Label style={{ marginTop: spacing.md }}>Passphrase</Label>
            <TextInput
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry
              placeholder="Your secret passphrase"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              label={mode === 'login' ? 'Enter space' : 'Create space'}
              onPress={submit}
              loading={busy}
              style={{ marginTop: spacing.lg }}
            />
            <Text style={styles.hint}>
              {mode === 'login'
                ? 'New here? Switch to “Create space”.'
                : 'Min 6-char name. You’ll get a recovery code.'}
            </Text>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  tagline: { color: colors.textDim, fontSize: font.small, marginTop: 4 },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    color: colors.textDim,
    fontWeight: '700',
    fontSize: font.small,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  tabActive: { backgroundColor: colors.primary + '33', color: colors.text },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 50,
    color: colors.text,
    fontSize: font.body,
  },
  error: { color: colors.red, fontSize: font.small, marginTop: spacing.md },
  hint: { color: colors.textFaint, fontSize: font.tiny, textAlign: 'center', marginTop: spacing.md },
  title: { color: colors.text, fontSize: font.h3, fontWeight: '800', marginBottom: 6 },
  subtle: { color: colors.textDim, fontSize: font.small, marginBottom: spacing.md },
  codeBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  code: { color: colors.primary2, fontSize: font.h3, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
});
