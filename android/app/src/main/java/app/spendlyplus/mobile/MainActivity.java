package app.spendlyplus.mobile;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Target refresh rate we ask the OS for.
    //
    // EXPERIMENT: we previously forced 120Hz, but the [PERF] logs show the WebView
    // can only rasterize ~46 unique scroll frames/sec on this content. Driving the
    // panel at 120Hz while the compositor can't keep up produces repeated/uneven
    // frames — that stutter feels WORSE than a rock-steady 60Hz. So we now request
    // a STABLE 60Hz cadence (the mode closest to 60 at the current resolution),
    // which the WebView can actually sustain, to see if scrolling feels smoother.
    // Bump back toward 120f if a higher stable rate turns out better on device.
    private static final float TARGET_HZ = 60f;

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
     * Ask the OS for a STABLE refresh rate the WebView can actually sustain
     * (TARGET_HZ, currently 60). We pick the supported mode at the CURRENT
     * resolution whose refresh rate is CLOSEST to TARGET_HZ — not the highest.
     * Locking to a cadence the compositor can hit avoids the repeated/uneven
     * frames that a forced 120Hz produces when raster can't keep up, which reads
     * as scroll stutter. No jarring resolution switch (same width/height).
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

            // Among modes at the current resolution, pick the refresh rate closest
            // to TARGET_HZ. Falls back to the current mode if nothing matches.
            Display.Mode chosen = current;
            float bestDelta = Math.abs(current.getRefreshRate() - TARGET_HZ);
            for (Display.Mode m : modes) {
                boolean sameSize = m.getPhysicalWidth() == current.getPhysicalWidth()
                        && m.getPhysicalHeight() == current.getPhysicalHeight();
                if (!sameSize) continue;
                float delta = Math.abs(m.getRefreshRate() - TARGET_HZ);
                if (delta < bestDelta - 0.1f) {
                    bestDelta = delta;
                    chosen = m;
                }
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
