import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  InteractionManager,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Download, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react-native';
import {
  APP_VERSION,
  NativeInstallerUnavailable,
  NeedsInstallPermission,
  checkForUpdate,
  downloadAndInstall,
  purgeStaleApks,
  updateShas,
} from '../lib/update';
import { colors, font, radius, spacing } from '../theme';

// While the app is open we quietly re-check for a newer APK on this cadence and
// whenever it returns to the foreground (throttled) — no user action required.
// The very first check is deferred until after the app's initial render +
// interactions settle (see InteractionManager below) so the CPU-heavy sha check
// never lengthens startup.
const AUTO_CHECK_MS = 10 * 60 * 1000; // 10 minutes (only while the app is open)
const FOREGROUND_THROTTLE_MS = 90 * 1000;
const FIRST_CHECK_DELAY_MS = 2500; // small extra breather after interactions finish

type Phase = 'idle' | 'available' | 'downloading' | 'installing' | 'error';

type UpdatesCtx = {
  checking: boolean;
  /** Manual check from the footer button (shows an "up to date" note). */
  check: (manual: boolean) => Promise<void>;
};

const Ctx = createContext<UpdatesCtx | null>(null);

export function useUpdates(): UpdatesCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUpdates must be used within UpdatesProvider');
  return v;
}

export function UpdatesProvider({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [versionName, setVersionName] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState('');
  const url = useRef('');
  const lastCheckAt = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  const check = useCallback(async (manual: boolean) => {
    // Never interrupt an in-flight download/install.
    if (phaseRef.current === 'downloading' || phaseRef.current === 'installing') return;
    // Don't stack an auto-check on top of an already-visible prompt.
    if (!manual && phaseRef.current === 'available') return;

    setChecking(true);
    lastCheckAt.current = Date.now();
    const r = await checkForUpdate();
    setChecking(false);

    if (r.status === 'available') {
      url.current = r.url;
      setVersionName(r.versionName);
      setProgress(0);
      setErrorMsg('');
      setPhase('available');
    } else if (manual) {
      if (r.status === 'latest') {
        // Show the compared digests so "up to date" is verifiable at a glance.
        const { installed, remote } = await updateShas();
        const short = (s: string | null) => (s ? s.slice(0, 12) : 'unavailable');
        Alert.alert(
          'You’re up to date',
          `Running the latest version (v${APP_VERSION}).\n\n` +
            `Installed APK:\n${short(installed)}\n\n` +
            `Latest on GitHub:\n${short(remote)}`,
        );
      } else {
        Alert.alert('Couldn’t check', 'Please check your connection and try again.');
      }
    }
  }, []);

  const confirm = useCallback(async () => {
    setPhase('downloading');
    setProgress(0);
    try {
      await downloadAndInstall(url.current, pct => setProgress(pct));
      // Download done; the OS installer is now in the foreground.
      setPhase('installing');
    } catch (e) {
      if (e instanceof NeedsInstallPermission) {
        setErrorMsg(
          'Allow “Install unknown apps” for Spendly-Plus in the settings screen that just opened, then tap Update again.',
        );
        setPhase('error');
      } else if (e instanceof NativeInstallerUnavailable) {
        // Old build without the installer bridge — fall back to a browser download.
        Linking.openURL(url.current).catch(() => {});
        setPhase('idle');
      } else {
        setErrorMsg('Download failed. Please check your connection and try again.');
        setPhase('error');
      }
    }
  }, []);

  const dismiss = useCallback(() => {
    if (phase === 'downloading') return; // don't allow cancelling mid-download
    setPhase('idle');
  }, [phase]);

  // Cleanup on cold launch + periodic/foreground auto-checks.
  useEffect(() => {
    purgeStaleApks();

    let first: ReturnType<typeof setTimeout> | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;

    // Hold the first check (and the periodic cadence) until the app has finished
    // its initial render + interactions — so opening the app stays snappy and the
    // update work only kicks in once all features are loaded.
    const task = InteractionManager.runAfterInteractions(() => {
      first = setTimeout(() => {
        check(false);
        // Re-check every 10 minutes, but ONLY while the app is actually open.
        interval = setInterval(() => {
          if (AppState.currentState === 'active') check(false);
        }, AUTO_CHECK_MS);
      }, FIRST_CHECK_DELAY_MS);
    });

    const onAppState = (s: AppStateStatus) => {
      if (s !== 'active') return;
      // If the installer was launched and the user came back, reset the prompt.
      if (phaseRef.current === 'installing') {
        setPhase('idle');
        return;
      }
      if (Date.now() - lastCheckAt.current > FOREGROUND_THROTTLE_MS) check(false);
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      task.cancel();
      if (first) clearTimeout(first);
      if (interval) clearInterval(interval);
      sub.remove();
    };
  }, [check]);

  const value = useMemo(() => ({ checking, check }), [checking, check]);

  const visible = phase !== 'idle';

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              {phase === 'error' ? (
                <TriangleAlert size={26} color={colors.amber} />
              ) : phase === 'installing' ? (
                <Download size={26} color={colors.green} />
              ) : (
                <Sparkles size={26} color={colors.primary} />
              )}
            </View>

            {phase === 'available' && (
              <>
                <Text style={styles.title}>Update available</Text>
                <Text style={styles.body}>
                  A newer version of Spendly-Plus{versionName ? ` (${versionName})` : ''} is ready.
                  It downloads in the background and installs in a tap.
                </Text>
                <View style={styles.row}>
                  <Pressable onPress={dismiss} style={[styles.btn, styles.btnGhost]}>
                    <Text style={styles.btnGhostText}>Later</Text>
                  </Pressable>
                  <Pressable onPress={confirm} style={[styles.btn, styles.btnPrimary]}>
                    <Text style={styles.btnPrimaryText}>Update now</Text>
                  </Pressable>
                </View>
              </>
            )}

            {phase === 'downloading' && (
              <>
                <Text style={styles.title}>Downloading…</Text>
                <Text style={styles.body}>Fetching the latest build. Please keep the app open.</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.pct}>{progress}%</Text>
              </>
            )}

            {phase === 'installing' && (
              <>
                <Text style={styles.title}>Installing…</Text>
                <Text style={styles.body}>
                  Follow the system installer to finish. The old file is removed automatically.
                </Text>
                <ActivityIndicator color={colors.green} style={{ marginTop: spacing.md }} />
              </>
            )}

            {phase === 'error' && (
              <>
                <Text style={styles.title}>Update didn’t start</Text>
                <Text style={styles.body}>{errorMsg}</Text>
                <View style={styles.row}>
                  <Pressable onPress={dismiss} style={[styles.btn, styles.btnGhost]}>
                    <Text style={styles.btnGhostText}>Close</Text>
                  </Pressable>
                  <Pressable onPress={confirm} style={[styles.btn, styles.btnPrimary]}>
                    <RefreshCw size={15} color="#0b0b16" />
                    <Text style={styles.btnPrimaryText}>Try again</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl,
    backgroundColor: '#141426',
    borderWidth: 1,
    borderColor: colors.border,
    borderTopColor: colors.sheen,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: font.h3, fontWeight: '800', textAlign: 'center' },
  body: {
    color: colors.textDim,
    fontSize: font.small,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, width: '100%' },
  btn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: '#0b0b16', fontSize: font.small, fontWeight: '800' },
  track: {
    width: '100%',
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  pct: { color: colors.textDim, fontSize: font.small, fontWeight: '700', marginTop: spacing.sm },
});
