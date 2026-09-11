package com.kioskfleet.agent

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.floatOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import java.io.File
import java.io.FileOutputStream
import java.net.URL

/**
 * Executes remote commands received from the KioskFleet panel.
 * All payloads arrive as JsonObject (jsonb column from Supabase).
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

    private fun JsonObject?.str(key: String): String? =
        this?.get(key)?.jsonPrimitive?.contentOrNull
    private fun JsonObject?.int(key: String): Int? =
        this?.get(key)?.jsonPrimitive?.intOrNull
    private fun JsonObject?.long(key: String): Long? =
        this?.get(key)?.jsonPrimitive?.longOrNull
    private fun JsonObject?.float(key: String): Float? =
        this?.get(key)?.jsonPrimitive?.floatOrNull
    private fun JsonObject?.bool(key: String): Boolean? =
        this?.get(key)?.jsonPrimitive?.booleanOrNull

    suspend fun execute(cmd: ApiClient.DeviceCommand) {
        var status = "completed"
        var output: String? = null
        val p = cmd.payload

        try {
            output = when (cmd.command_type) {
                "lock" -> lockDevice()
                "reboot" -> rebootDevice()
                "screenshot" -> takeScreenshot()
                "install_app" -> installApp(p.str("url") ?: p.str("apk_url"))
                "uninstall_app" -> uninstallApp(p.str("package"))
                "launch_app", "open_app" -> launchApp(p.str("package"))
                "set_kiosk_mode" -> setKioskMode(p.bool("enabled") ?: true)
                "send_message" -> showMessage(p.str("text") ?: p.str("message") ?: "")
                "set_brightness" -> setBrightness(p.int("level"))
                "set_volume" -> setVolume(p.int("level"))
                "clear_cache" -> clearCache(p.str("package"))
                "force_stop_app" -> forceStopApp(p.str("package"))
                "tap" -> dispatchTap(p, longPress = false)
                "long_press" -> dispatchTap(p, longPress = true)
                "swipe" -> dispatchSwipe(p)
                "key" -> dispatchKey(p.str("key"))
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

    // ---------- Remote input (Accessibility) ----------

    private fun dispatchTap(p: JsonObject?, longPress: Boolean): String {
        val x = p.float("x") ?: throw Exception("tap requires x")
        val y = p.float("y") ?: throw Exception("tap requires y")
        val duration = p.long("duration") ?: if (longPress) 600L else 80L
        RemoteControlService.pendingGesture = RemoteControlService.GestureRequest(
            type = if (longPress) "long_press" else "tap",
            x = x, y = y, duration = duration,
        )
        RemoteControlService.wake()
        return "Tap dispatched at ($x,$y)"
    }

    private fun dispatchSwipe(p: JsonObject?): String {
        val x = p.float("x") ?: throw Exception("swipe requires x")
        val y = p.float("y") ?: throw Exception("swipe requires y")
        val ex = p.float("end_x") ?: throw Exception("swipe requires end_x")
        val ey = p.float("end_y") ?: throw Exception("swipe requires end_y")
        val duration = p.long("duration") ?: 250L
        RemoteControlService.pendingGesture = RemoteControlService.GestureRequest(
            type = "swipe",
            x = x, y = y, endX = ex, endY = ey, duration = duration,
        )
        RemoteControlService.wake()
        return "Swipe dispatched ($x,$y)->($ex,$ey)"
    }

    private fun dispatchKey(key: String?): String {
        val k = key ?: throw Exception("key required")
        RemoteControlService.pendingKeyAction = k
        RemoteControlService.wake()
        return "Key dispatched: $k"
    }

    // ---------- Device management ----------

    private fun lockDevice(): String {
        if (devicePolicyManager.isAdminActive(componentName)) {
            devicePolicyManager.lockNow()
            return "Device locked"
        }
        throw Exception("Device Admin not active — cannot lock")
    }

    private fun rebootDevice(): String {
        if (devicePolicyManager.isAdminActive(componentName)) {
            devicePolicyManager.reboot(componentName)
            return "Reboot initiated"
        }
        throw Exception("Device Admin not active — cannot reboot")
    }

    private suspend fun takeScreenshot(): String = withContext(Dispatchers.IO) {
        val intent = Intent(context, ScreenCaptureService::class.java).apply {
            action = ScreenCaptureService.ACTION_CAPTURE_NOW
        }
        context.startService(intent)
        "Screenshot requested"
    }

    private suspend fun installApp(apkUrl: String?): String = withContext(Dispatchers.IO) {
        val url = apkUrl ?: throw Exception("No APK URL provided")
        val tmpFile = File(context.cacheDir, "install_${System.currentTimeMillis()}.apk")
        URL(url).openStream().use { input ->
            FileOutputStream(tmpFile).use { output -> input.copyTo(output) }
        }
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.fromFile(tmpFile), "application/vnd.android.package-archive")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
        }
        context.startActivity(intent)
        "Install started: $url"
    }

    private fun uninstallApp(pkg: String?): String {
        val p = pkg ?: throw Exception("No package name provided")
        val intent = Intent(Intent.ACTION_DELETE).apply {
            data = Uri.parse("package:$p")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
        return "Uninstall started: $p"
    }

    private fun launchApp(pkg: String?): String {
        val p = pkg ?: throw Exception("No package name provided")
        val intent = context.packageManager.getLaunchIntentForPackage(p)
            ?: throw Exception("App not found: $p")
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        context.startActivity(intent)
        return "Launched: $p"
    }

    private fun setKioskMode(enabled: Boolean): String {
        KioskApp.kioskModeEnabled = enabled
        return "Kiosk mode ${if (enabled) "enabled" else "disabled"}"
    }

    private fun showMessage(msg: String): String {
        android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_LONG).show()
        return "Message shown"
    }

    private fun setBrightness(level: Int?): String {
        val v = level ?: throw Exception("Invalid brightness value")
        val clamped = v.coerceIn(0, 255)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.System.canWrite(context)) {
            throw Exception("WRITE_SETTINGS permission not granted")
        }
        Settings.System.putInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, clamped)
        return "Brightness set to $clamped"
    }

    private fun setVolume(level: Int?): String {
        val v = level ?: throw Exception("Invalid volume value")
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
        val maxVol = audioManager.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC)
        val target = (v * maxVol / 100).coerceIn(0, maxVol)
        audioManager.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, target, 0)
        return "Volume set to $v%"
    }

    private fun clearCache(pkg: String?): String {
        return "Clear cache requested for: ${pkg ?: "all apps"}"
    }

    private fun forceStopApp(pkg: String?): String {
        val p = pkg ?: throw Exception("No package name provided")
        return "Force stop requested for: $p (requires system permission or accessibility)"
    }
}
