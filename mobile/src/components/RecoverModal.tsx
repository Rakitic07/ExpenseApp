import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  KeyRound,
  LifeBuoy,
  ShieldQuestion,
  Ticket,
  UserSearch,
  X,
} from 'lucide-react-native';
import { api } from '../lib/api';
import { colors, font, radius, spacing } from '../theme';

type Step =
  | 'choose'
  | 'find'
  | 'code'
  | 'code-done'
  | 'request'
  | 'request-done'
  | 'status';

const EMPTY_Q = {
  approxCreated: '',
  recentExpense: '',
  recentAmount: '',
  payerName: '',
  budget: '',
  note: '',
};

export function RecoverModal({
  open,
  onClose,
  initialName,
}: {
  open: boolean;
  onClose: () => void;
  initialName?: string;
}) {
  const [step, setStep] = useState<Step>('choose');
  const [name, setName] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [ticket, setTicket] = useState('');
  const [q, setQ] = useState(EMPTY_Q);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [issuedTicket, setIssuedTicket] = useState('');
  const [statusResult, setStatusResult] = useState<string | null>(null);
  const [findQuery, setFindQuery] = useState('');
  const [findPass, setFindPass] = useState('');
  const [findResults, setFindResults] = useState<string[] | null>(null);

  // Reset all state whenever the sheet is (re)opened.
  const reset = () => {
    setStep('choose');
    setName(initialName ?? '');
    setRecoveryCode('');
    setPassphrase('');
    setTicket('');
    setQ(EMPTY_Q);
    setLoading(false);
    setError(null);
    setNewCode('');
    setIssuedTicket('');
    setStatusResult(null);
    setFindQuery('');
    setFindPass('');
    setFindResults(null);
  };

  const close = () => {
    onClose();
  };

  const back = () => {
    setError(null);
    setStep('choose');
  };

  const submitCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.recover(name.trim(), recoveryCode.trim(), passphrase);
      setNewCode(res.recoveryCode);
      setStep('code-done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const submitRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.requestReset(name.trim(), passphrase, q);
      setIssuedTicket(res.ticket);
      setStep('request-done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const submitStatus = async () => {
    setLoading(true);
    setError(null);
    setStatusResult(null);
    try {
      const res = await api.resetStatus(name.trim(), ticket.trim());
      setStatusResult(res.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const submitFind = async () => {
    setLoading(true);
    setError(null);
    setFindResults(null);
    try {
      const res = await api.findSpace(findQuery.trim(), findPass || undefined);
      setFindResults(res.matches);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onShow={reset}
      onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headLeft}>
              <View style={styles.headIcon}>
                <LifeBuoy size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.headTitle}>Recover access</Text>
                <Text style={styles.headSub}>Forgot your passphrase?</Text>
              </View>
            </View>
            <Pressable onPress={close} hitSlop={10} style={styles.closeBtn}>
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled">
            {step === 'choose' && (
              <View style={{ gap: spacing.sm }}>
                {name ? (
                  <Text style={styles.usingNote}>
                    Using space <Text style={styles.usingName}>{name}</Text> — now pick how to recover.
                  </Text>
                ) : null}
                <OptionBtn
                  icon={<KeyRound size={20} color={colors.green} />}
                  title="I have my recovery code"
                  sub="Reset instantly, no admin needed"
                  onPress={() => setStep('code')}
                />
                <OptionBtn
                  icon={<ShieldQuestion size={20} color={colors.amber} />}
                  title="Request an admin reset"
                  sub="Answer a few questions to verify it's you"
                  onPress={() => setStep('request')}
                />
                <OptionBtn
                  icon={<Ticket size={20} color={colors.accent} />}
                  title="Check a request's status"
                  sub="Use the ticket code you were given"
                  onPress={() => setStep('status')}
                />
                <Pressable
                  onPress={() => setStep('find')}
                  hitSlop={8}
                  style={styles.findLinkWrap}>
                  <UserSearch size={14} color={colors.textDim} />
                  <Text style={styles.findLink}>Forgot your space name too?</Text>
                </Pressable>
              </View>
            )}

            {step === 'find' && (
              <View style={{ gap: spacing.sm }}>
                <BackBtn onPress={back} />
                <Text style={styles.hintBox}>
                  Type the first few characters of your space name (at least 4). Don't remember any of
                  it? Enter your full passphrase instead and we'll find the matching space.
                </Text>
                <Field
                  label="First characters of the name"
                  value={findQuery}
                  onChangeText={setFindQuery}
                  placeholder="e.g. rakt (min 4)"
                />
                <Field
                  label="…or your passphrase"
                  value={findPass}
                  onChangeText={setFindPass}
                  placeholder="your full passphrase"
                  secure
                />
                {error ? <ErrorBox msg={error} /> : null}
                <SubmitBtn loading={loading} label="Search" onPress={submitFind} />
                {findResults ? (
                  findResults.length === 0 ? (
                    <Text style={styles.noMatch}>
                      No matching space found. Try different letters or your exact passphrase.
                    </Text>
                  ) : (
                    <View style={{ gap: 6, paddingTop: 4 }}>
                      <Text style={styles.matchHead}>Matches — tap to use</Text>
                      {findResults.map(m => (
                        <Pressable
                          key={m}
                          onPress={() => {
                            setName(m);
                            setError(null);
                            setStep('choose');
                          }}
                          android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
                          style={styles.matchRow}>
                          <Text style={styles.matchName}>{m}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )
                ) : null}
              </View>
            )}

            {step === 'code' && (
              <View style={{ gap: spacing.sm }}>
                <BackBtn onPress={back} />
                <Field label="Space name" value={name} onChangeText={setName} placeholder="Your space name" />
                <Field
                  label="Recovery code"
                  value={recoveryCode}
                  onChangeText={setRecoveryCode}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  mono
                />
                <Field
                  label="New passphrase"
                  value={passphrase}
                  onChangeText={setPassphrase}
                  placeholder="min 6 characters"
                  secure
                />
                {error ? <ErrorBox msg={error} /> : null}
                <SubmitBtn loading={loading} label="Reset passphrase" onPress={submitCode} />
              </View>
            )}

            {step === 'code-done' && (
              <View style={{ gap: spacing.md }}>
                <Text style={[styles.resultBox, styles.okBox]}>
                  Passphrase reset! Unlock your space with your new passphrase.
                </Text>
                <Text style={styles.codeCaption}>Your new recovery code (save it — shown once):</Text>
                <CodeBox code={newCode} />
                <SubmitBtn label="Done — back to unlock" onPress={close} />
              </View>
            )}

            {step === 'request' && (
              <View style={{ gap: spacing.sm }}>
                <BackBtn onPress={back} />
                <Text style={styles.hintBox}>
                  An admin verifies these against your real data before approving. Fill what you remember.
                </Text>
                <Field label="Space name" value={name} onChangeText={setName} placeholder="Your space name" />
                <Field
                  label="New passphrase you want"
                  value={passphrase}
                  onChangeText={setPassphrase}
                  placeholder="min 6 characters"
                  secure
                />
                <Field
                  label="Roughly when did you create it?"
                  value={q.approxCreated}
                  onChangeText={v => setQ({ ...q, approxCreated: v })}
                  placeholder="e.g. July 2026"
                />
                <Field
                  label="A recent expense title"
                  value={q.recentExpense}
                  onChangeText={v => setQ({ ...q, recentExpense: v })}
                  placeholder="e.g. Petrol"
                />
                <Field
                  label="A recent amount"
                  value={q.recentAmount}
                  onChangeText={v => setQ({ ...q, recentAmount: v })}
                  placeholder="e.g. 435"
                  keyboardType="numeric"
                />
                <Field
                  label="A payer name you use"
                  value={q.payerName}
                  onChangeText={v => setQ({ ...q, payerName: v })}
                  placeholder="e.g. Rak"
                />
                <Field
                  label="Monthly budget (if set)"
                  value={q.budget}
                  onChangeText={v => setQ({ ...q, budget: v })}
                  placeholder="e.g. 35000"
                  keyboardType="numeric"
                />
                <Field
                  label="Anything else to prove it's you"
                  value={q.note}
                  onChangeText={v => setQ({ ...q, note: v })}
                  placeholder="optional"
                />
                {error ? <ErrorBox msg={error} /> : null}
                <SubmitBtn loading={loading} label="Submit request" onPress={submitRequest} />
              </View>
            )}

            {step === 'request-done' && (
              <View style={{ gap: spacing.md }}>
                <Text style={[styles.resultBox, styles.infoBox]}>
                  Request submitted. Save this ticket code — it's the only way to check status and it's
                  shown once. Once an admin approves, unlock with the new passphrase you chose.
                </Text>
                <CodeBox code={issuedTicket} />
                <SubmitBtn label="Check status now" variant="ghost" onPress={() => setStep('status')} />
                <SubmitBtn label="Done" onPress={close} />
              </View>
            )}

            {step === 'status' && (
              <View style={{ gap: spacing.sm }}>
                <BackBtn onPress={back} />
                <Field label="Space name" value={name} onChangeText={setName} placeholder="Your space name" />
                <Field
                  label="Ticket code"
                  value={ticket}
                  onChangeText={setTicket}
                  placeholder="XXXX-XXXX-XXXX"
                  mono
                />
                {error ? <ErrorBox msg={error} /> : null}
                <SubmitBtn loading={loading} label="Check status" onPress={submitStatus} />
                {statusResult ? <StatusResult status={statusResult} /> : null}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- building blocks ---------- */

function OptionBtn({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
      style={styles.option}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

function BackBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.backBtn}>
      <ArrowLeft size={14} color={colors.textDim} />
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  mono,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  mono?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType ?? 'default'}
        style={[styles.input, mono && styles.mono]}
      />
    </View>
  );
}

function SubmitBtn({
  loading,
  label,
  onPress,
  variant = 'primary',
}: {
  loading?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
      style={({ pressed }) => [
        styles.submit,
        primary ? styles.submitPrimary : styles.submitGhost,
        (loading || pressed) && { opacity: 0.7 },
      ]}>
      <Text style={[styles.submitText, !primary && { color: colors.text }]}>
        {loading ? 'Please wait…' : label}
      </Text>
    </Pressable>
  );
}

function CodeBox({ code }: { code: string }) {
  return (
    <View style={styles.codeBox}>
      <Text selectable style={styles.code}>
        {code}
      </Text>
    </View>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <Text style={styles.errorBox}>{msg}</Text>;
}

function StatusResult({ status }: { status: string }) {
  const map: Record<string, { text: string; box: object }> = {
    pending: {
      text: '⏳ Pending — an admin hasn\'t reviewed it yet. Check back later.',
      box: styles.warnBox,
    },
    approved: {
      text: '✅ Approved! Unlock your space with the new passphrase you chose.',
      box: styles.okBox,
    },
    rejected: {
      text: '❌ Rejected. Submit a new request with more identifying details.',
      box: styles.dangerBox,
    },
    notfound: {
      text: 'No request found for that space + ticket code.',
      box: styles.neutralBox,
    },
  };
  const s = map[status] ?? map.notfound;
  return <Text style={[styles.resultBox, s.box]}>{s.text}</Text>;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: '#141426',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopColor: colors.sheen,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primary + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: { color: colors.text, fontSize: font.h3, fontWeight: '800' },
  headSub: { color: colors.textFaint, fontSize: font.tiny },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { gap: spacing.sm, paddingBottom: spacing.md },
  usingNote: {
    color: colors.textDim,
    fontSize: font.tiny,
    backgroundColor: colors.green + '18',
    borderWidth: 1,
    borderColor: colors.green + '40',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  usingName: { color: colors.text, fontWeight: '800' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionTitle: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  optionSub: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  findLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: spacing.xs,
  },
  findLink: { color: colors.textDim, fontSize: font.tiny, textDecorationLine: 'underline' },
  hintBox: {
    color: colors.textDim,
    fontSize: font.tiny,
    lineHeight: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  backText: { color: colors.textDim, fontSize: font.tiny, fontWeight: '600' },
  fieldLabel: { color: colors.textDim, fontSize: font.tiny, fontWeight: '600', marginBottom: 5 },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 46,
    color: colors.text,
    fontSize: font.body,
  },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 1 },
  submit: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  submitPrimary: { backgroundColor: colors.primary },
  submitGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong },
  submitText: { color: '#fff', fontSize: font.body, fontWeight: '800' },
  codeBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  code: {
    color: colors.primary2,
    fontSize: font.h3,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeCaption: { color: colors.textDim, fontSize: font.tiny, fontWeight: '600' },
  errorBox: {
    color: '#ffb3b3',
    fontSize: font.small,
    backgroundColor: colors.red + '1c',
    borderWidth: 1,
    borderColor: colors.red + '4d',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  resultBox: {
    color: colors.text,
    fontSize: font.small,
    lineHeight: 19,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  okBox: { backgroundColor: colors.green + '1c', borderColor: colors.green + '4d' },
  infoBox: { backgroundColor: colors.accent + '1c', borderColor: colors.accent + '4d' },
  warnBox: { backgroundColor: colors.amber + '1c', borderColor: colors.amber + '4d' },
  dangerBox: { backgroundColor: colors.red + '1c', borderColor: colors.red + '4d' },
  neutralBox: { backgroundColor: colors.surface, borderColor: colors.border },
  noMatch: {
    color: colors.textDim,
    fontSize: font.small,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  matchHead: { color: colors.textFaint, fontSize: font.tiny, textTransform: 'uppercase', letterSpacing: 0.5 },
  matchRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  matchName: { color: colors.text, fontSize: font.small, fontWeight: '600' },
});
