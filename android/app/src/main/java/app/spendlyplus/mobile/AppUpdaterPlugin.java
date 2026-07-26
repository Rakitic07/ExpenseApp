package app.spendlyplus.mobile;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.CookieManager;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/**
 * Minimal, self-contained updater for sideloaded (non-Play-Store) builds.
 *
 * getInfo()            -> { versionCode, versionName } of the running app.
 * downloadAndInstall() -> downloads the given APK and launches the system
 *                         installer. Android never allows a truly silent
 *                         install for a normal app, so the user confirms once.
 *
 * Security: the download URL is host-allowlisted to GitHub, so a compromised
 * web page cannot make the app fetch and install an arbitrary APK.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static boolean isAllowedHost(URL url) {
        if (!"https".equalsIgnoreCase(url.getProtocol())) return false;
        String host = url.getHost().toLowerCase(Locale.ROOT);
        return host.equals("github.com")
                || host.equals("codeload.github.com")
                || host.endsWith(".githubusercontent.com");
    }

    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo pi = pm.getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? pi.getLongVersionCode()
                    : (long) pi.versionCode;
            JSObject ret = new JSObject();
            ret.put("versionCode", code);
            ret.put("versionName", pi.versionName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Unable to read app info", e);
        }
    }

    /**
     * Hard-clears the WebView's cookies (the session cookie lives here). Android's
     * WebView does not reliably flush cookie removals to disk before the app is
     * killed, so a cleared session could reappear on the next launch — this makes
     * logout deterministic by removing every cookie and flushing immediately.
     */
    @PluginMethod
    public void clearCookies(PluginCall call) {
        try {
            CookieManager cm = CookieManager.getInstance();
            cm.removeAllCookies(null);
            cm.flush();
            call.resolve();
        } catch (Exception e) {
            call.reject("Unable to clear cookies", e);
        }
    }

    @PluginMethod
    public void downloadAndInstall(final PluginCall call) {
        final String urlStr = call.getString("url");
        if (urlStr == null || urlStr.isEmpty()) {
            call.reject("Missing url");
            return;
        }

        final URL url;
        try {
            url = new URL(urlStr);
        } catch (Exception e) {
            call.reject("Invalid url");
            return;
        }
        if (!isAllowedHost(url)) {
            call.reject("Refusing to download from an untrusted host");
            return;
        }

        // Android O+ requires explicit permission to install from this app.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                        .setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception ignored) {
            }
            JSObject ret = new JSObject();
            ret.put("status", "permission_required");
            call.resolve(ret);
            return;
        }

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                File dir = getContext().getExternalFilesDir("updates");
                if (dir != null && !dir.exists()) dir.mkdirs();
                File apk = new File(dir, "spendly-plus-update.apk");
                if (apk.exists()) apk.delete();

                conn = (HttpURLConnection) url.openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(60000);
                conn.connect();

                if (conn.getResponseCode() / 100 != 2) {
                    call.reject("Download failed (HTTP " + conn.getResponseCode() + ")");
                    return;
                }

                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
                    out.flush();
                }

                Uri uri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        apk);
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(uri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(install);

                JSObject ret = new JSObject();
                ret.put("status", "installing");
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Update failed: " + e.getMessage(), e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }
}
