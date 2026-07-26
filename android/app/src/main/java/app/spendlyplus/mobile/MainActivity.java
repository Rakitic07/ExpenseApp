package app.spendlyplus.mobile;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Target refresh rate we ask the OS for. Panels only support their native
    // rates, so on a 120Hz phone this gives 120fps; on 90Hz it falls back to the
    // highest available; on 60Hz it stays 60.
    private static final float TARGET_HZ = 120f;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        applyTargetRefreshRate();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-assert on resume: the system can reset the window's preferred mode
        // after backgrounding, which would silently drop us back to 60Hz.
        applyTargetRefreshRate();
    }

    /**
     * Ask the OS to run this window at 120Hz (TARGET_HZ) so WebView scrolling and
     * animations get up to 120fps instead of the default 60fps cap. We prefer a
     * 120Hz mode at the CURRENT resolution (no jarring resolution switch); only
     * if 120Hz isn't offered at this resolution do we accept a 120Hz mode at a
     * different resolution, and otherwise fall back to the highest rate available.
     */
    private void applyTargetRefreshRate() {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return; // getSupportedModes: API 23+

            Window window = getWindow();
            Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? getDisplay()
                    : window.getWindowManager().getDefaultDisplay();
            if (display == null) return;

            Display.Mode current = display.getMode();
            Display.Mode[] modes = display.getSupportedModes();
            if (modes == null || modes.length == 0) return;

            Display.Mode bestSameRes = current;   // highest rate at current resolution
            Display.Mode bestAny = current;        // highest rate overall
            for (Display.Mode m : modes) {
                if (m.getRefreshRate() > bestAny.getRefreshRate() + 0.1f) {
                    bestAny = m;
                }
                boolean sameSize = m.getPhysicalWidth() == current.getPhysicalWidth()
                        && m.getPhysicalHeight() == current.getPhysicalHeight();
                if (sameSize && m.getRefreshRate() > bestSameRes.getRefreshRate() + 0.1f) {
                    bestSameRes = m;
                }
            }

            // Prefer hitting ~120Hz at the current resolution; if that isn't
            // possible, take a 120Hz mode at any resolution; else the best we can.
            Display.Mode chosen;
            if (bestSameRes.getRefreshRate() >= TARGET_HZ - 1f) {
                chosen = bestSameRes;
            } else if (bestAny.getRefreshRate() >= TARGET_HZ - 1f) {
                chosen = bestAny;
            } else {
                chosen = bestSameRes;
            }

            WindowManager.LayoutParams params = window.getAttributes();
            params.preferredDisplayModeId = chosen.getModeId();
            // Also express the intent as a refresh rate (helps on Android 11+ where
            // the system may pick within a range).
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                params.preferredRefreshRate = chosen.getRefreshRate();
            }
            window.setAttributes(params);
        } catch (Exception ignored) {
            // Refresh-rate control is best-effort; never crash the app over it.
        }
    }
}
