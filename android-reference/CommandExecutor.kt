package com.kioskfleet.agent

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.URL

/**
 * Executes remote commands received from the KioskFleet panel.
 * Each command runs in a background coroutine and reports result back.
 */
class CommandExecutor(
    private val context: Context,
    private val apiClient: ApiClient,
) {
    private val devicePolicyManager: DevicePolicyManager =
        context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val componentName = ComponentName(context, KioskDeviceAdminReceiver::class.java)

    companion object {
        private const val TAG = "CommandExecutor"
    }

    suspend fun execute(cmd: ApiClient.DeviceCommand) {
        var status = "completed"
        var output: String? = null

        try {
            output = when (cmd.command_type) {
                "lock" -> lockDevice()
                "reboot" -> rebootDevice()
                "screenshot" -> takeScreenshot()
                "install_app" -> installApp(cmd.payload)
                "uninstall_app" -> uninstallApp(cmd.payload)
                "launch_app", "open_app" -> launchApp(cmd.payload)
                "set_kiosk_mode" -> setKioskMode(cmd.payload)
                "send_message" -> showMessage(cmd.payload)
                "set_brightness" -> setBrightness(cmd.payload)
                "set_volume" -> setVolume(cmd.payload)
                "clear_cache" -> clearCache(cmd.payload)
                "force_stop_app" -> forceStopApp(cmd.payload)
                "tap" -> dispatchTap(cmd.payload, longPress = false)
                "long_press" -> dispatchTap(cmd.payload, longPress = true)
                "swipe" -> dispatchSwipe(cmd.payload)
                "key" -> dispatchKey(cmd.payload)
                "update_policy" -> "Policy update received (apply in KioskApp)"
                "ping" -> "pong"
                else -> "Unknown command: ${cmd.command_type}"
            }
        } catch (e: Exception) {
            Log.e(TAG, "Command ${cmd.command_type} failed", e)
            status = "failed"
            output = e.message
        }

        try {
            apiClient.reportCommandResult(cmd.id, status, output)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to report result: ${e.message}")
        }
    }

    private fun lockDevice(): String {
        if (devicePolicyManager.isAdminActive(componentName)) {
            devicePolicyManager.lockNow()
            return "Device locked"
        }
        // Fallback: use accessibility service to press power
        throw Exception("Device Admin not active — cannot lock")
    }

    private fun rebootDevice(): String {
        if (devicePolicyManager.isAdminActive(componentName)) {
            // Requires DEVICE_ADMIN with reboot privilege (Android 7+)
            devicePolicyManager.reboot(componentName)
            return "Reboot initiated"
        }
        throw Exception("Device Admin not active — cannot reboot")
    }

    private suspend fun takeScreenshot(): String = withContext(Dispatchers.IO) {
        // Start ScreenCaptureService if not running; it will upload automatically
        val intent = Intent(context, ScreenCaptureService::class.java).apply {
            action = ScreenCaptureService.ACTION_CAPTURE_NOW
        }
        context.startService(intent)
        "Screenshot requested"
    }

    private suspend fun installApp(payload: String?): String = withContext(Dispatchers.IO) {
        val apkUrl = payload ?: throw Exception("No APK URL provided")
        // Download APK to cache
        val tmpFile = File(context.cacheDir, "install_${System.currentTimeMillis()}.apk")
        URL(apkUrl).openStream().use { input ->
            FileOutputStream(tmpFile).use { output -> input.copyTo(output) }
        }
        // Trigger package installer
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.fromFile(tmpFile), "application/vnd.android.package-archive")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
            flags = flags or Intent.FLAG_GRANT_READ_URI_PERMISSION
        }
        context.startActivity(intent)
        "Install started: $apkUrl"
    }

    private fun uninstallApp(payload: String?): String {
        val pkg = payload ?: throw Exception("No package name provided")
        val intent = Intent(Intent.ACTION_DELETE).apply {
            data = Uri.parse("package:$pkg")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
        return "Uninstall started: $pkg"
    }

    private fun launchApp(payload: String?): String {
        val pkg = payload ?: throw Exception("No package name provided")
        val intent = context.packageManager.getLaunchIntentForPackage(pkg)
            ?: throw Exception("App not found: $pkg")
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        context.startActivity(intent)
        return "Launched: $pkg"
    }

    private fun setKioskMode(payload: String?): String {
        val enabled = payload?.toBooleanStrictOrNull() ?: true
        // Update KioskApp state; RemoteControlService will enforce
        KioskApp.kioskModeEnabled = enabled
        return "Kiosk mode ${if (enabled) "enabled" else "disabled"}"
    }

    private fun showMessage(payload: String?): String {
        val msg = payload ?: ""
        // Show overlay message via accessibility service or toast
        // In production: use a WindowManager overlay
        android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_LONG).show()
        return "Message shown"
    }

    private fun setBrightness(payload: String?): String {
        val level = payload?.toIntOrNull() ?: throw Exception("Invalid brightness value")
        val clamped = level.coerceIn(0, 255)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.System.canWrite(context)) {
            throw Exception("WRITE_SETTINGS permission not granted")
        }
        Settings.System.putInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, clamped)
        return "Brightness set to $clamped"
    }

    private fun setVolume(payload: String?): String {
        val level = payload?.toIntOrNull() ?: throw Exception("Invalid volume value")
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
        val maxVol = audioManager.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC)
        val target = (level * maxVol / 100).coerceIn(0, maxVol)
        audioManager.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, target, 0)
        return "Volume set to $level%"
    }

    private fun clearCache(payload: String?): String {
        val pkg = payload
        // Clear app cache via accessibility or package manager
        // Requires accessibility service to navigate to Settings -> Storage -> Clear cache
        return "Clear cache requested for: ${pkg ?: "all apps"}"
    }

    private fun forceStopApp(payload: String?): String {
        val pkg = payload ?: throw Exception("No package name provided")
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        // Note: forceStopPackage requires FORCE_STOP_PACKAGES permission (system-signed)
        // Fallback: use accessibility service to force stop via Settings UI
        return "Force stop requested for: $pkg (requires system permission or accessibility)"
    }
}
