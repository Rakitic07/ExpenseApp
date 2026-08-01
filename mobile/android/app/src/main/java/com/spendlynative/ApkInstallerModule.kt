package com.spendlynative

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/**
 * Minimal bridge that hands a downloaded APK to the Android package installer.
 *
 * Sideloaded installs always surface the system installer confirmation (unless
 * the app is a device owner), so this can't be fully silent — but from JS we
 * download in the background, then call [install] to launch the installer with a
 * single tap. The old APK is cleaned up by JS on the next launch.
 */
class ApkInstallerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  /** Whether the OS will let us request package installs (Android 8+ gate). */
  @ReactMethod
  fun canInstall(promise: Promise) {
    try {
      val can =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          reactContext.packageManager.canRequestPackageInstalls()
        } else {
          true
        }
      promise.resolve(can)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  /** Opens the per-app "Install unknown apps" settings page. */
  @ReactMethod
  fun requestInstallPermission(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val intent =
          Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
            .setData(Uri.parse("package:" + reactContext.packageName))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ERR_SETTINGS", e)
    }
  }

  /** Launches the system installer for the APK at [path] (absolute file path). */
  @ReactMethod
  fun install(path: String, promise: Promise) {
    try {
      val file = File(path)
      if (!file.exists()) {
        promise.reject("ERR_NO_FILE", "APK not found at $path")
        return
      }
      val authority = reactContext.packageName + ".fileprovider"
      val uri = FileProvider.getUriForFile(reactContext, authority, file)
      val intent =
        Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ERR_INSTALL", e)
    }
  }

  /**
   * sha256 (lowercase hex) of the currently-installed APK. Lets JS compare the
   * running binary against the latest GitHub release digest directly, instead of
   * relying on a first-seen baseline. Reads the base APK at sourceDir; on a split
   * install this is still the primary APK GitHub serves.
   */
  @ReactMethod
  fun installedSha(promise: Promise) {
    try {
      val sourceDir = reactContext.applicationInfo.sourceDir
      val md = MessageDigest.getInstance("SHA-256")
      FileInputStream(File(sourceDir)).use { input ->
        val buf = ByteArray(64 * 1024)
        while (true) {
          val read = input.read(buf)
          if (read <= 0) break
          md.update(buf, 0, read)
        }
      }
      val hex = md.digest().joinToString("") { "%02x".format(it) }
      promise.resolve(hex)
    } catch (e: Exception) {
      promise.reject("ERR_SHA", e)
    }
  }

  companion object {
    const val NAME = "ApkInstaller"
  }
}
