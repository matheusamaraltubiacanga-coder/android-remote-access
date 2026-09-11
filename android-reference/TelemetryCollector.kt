package com.kioskfleet.agent

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.StatFs
import android.os.BatteryManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import java.net.NetworkInterface
import java.util.Locale

/**
 * Collects device telemetry for reporting to the KioskFleet panel.
 */
object TelemetryCollector {

    fun collect(context: Context): ApiClient.TelemetryPayload {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)

        val battery = getBatteryInfo(context)
        val storage = getStorageInfo()
        val network = getNetworkInfo(context)
        val location = getApproxLocation(context)

        val currentApp = getCurrentApp(context)

        return ApiClient.TelemetryPayload(
            battery_level = battery?.first,
            battery_charging = battery?.second,
            cpu_usage = getCpuUsage(),
            memory_used_mb = mi.availMem / (1024 * 1024),
            memory_total_mb = mi.totalMem / (1024 * 1024),
            storage_used_mb = storage?.first,
            storage_total_mb = storage?.second,
            current_app = currentApp,
            network_type = network?.first,
            ip_address = network?.second,
            latitude = location?.first,
            longitude = location?.second,
            wifi_strength = getWifiStrength(context),
            uptime_seconds = android.os.SystemClock.elapsedRealtime() / 1000,
            android_version = Build.VERSION.RELEASE,
            model = Build.MODEL,
        )
    }

    private fun getBatteryInfo(context: Context): Pair<Int?, Boolean?> {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val charging = bm.isCharging
        return Pair(level.takeIf { it >= 0 }, charging)
    }

    private fun getStorageInfo(): Pair<Long?, Long?>? {
        return try {
            val stat = StatFs(android.os.Environment.getDataDirectory().path)
            val total = stat.totalBytes / (1024 * 1024)
            val available = stat.availableBytes / (1024 * 1024)
            val used = total - available
            Pair(used, total)
        } catch (e: Exception) {
            null
        }
    }

    private fun getNetworkInfo(context: Context): Pair<String?, String?>? {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return null
        val caps = cm.getNetworkCapabilities(network) ?: return null

        val type = when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            else -> "unknown"
        }

        val ip = getLocalIpAddress()
        return Pair(type, ip)
    }

    private fun getLocalIpAddress(): String? {
        return try {
            NetworkInterface.getNetworkInterfaces()
                .toList()
                .flatMap { it.inetAddresses.toList() }
                .firstOrNull { !it.isLoopbackAddress && it.hostAddress?.contains(':') == false }
                ?.hostAddress
        } catch (e: Exception) {
            null
        }
    }

    private fun getWifiStrength(context: Context): Int? {
        // Requires ACCESS_FINE_LOCATION on Android 10+
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = cm.activeNetwork ?: return null
            val caps = cm.getNetworkCapabilities(network) ?: return null
            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                caps.signalStrength
            } else null
        } catch (e: Exception) {
            null
        }
    }

    private fun getCurrentApp(context: Context): String? {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val tasks = am.runningAppProcesses ?: return null
        return tasks
            .filter { it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND }
            .firstOrNull()
            ?.processName
    }

    private fun getCpuUsage(): Double? {
        // Read /proc/stat for CPU usage (simplified — single sample)
        return try {
            val runtime = Runtime.getRuntime()
            // This is a rough approximation; true CPU usage needs two samples
            null // Placeholder — production app would read /proc/stat twice
        } catch (e: Exception) {
            null
        }
    }

    private fun getApproxLocation(context: Context): Pair<Double?, Double?>? {
        // Requires location permission; return null if not granted
        // In production: use FusedLocationProviderClient
        return null
    }
}
