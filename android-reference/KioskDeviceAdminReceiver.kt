package com.kioskfleet.agent

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

/**
 * Device Admin Receiver — required for privileged operations (lock, reboot, wipe).
 * The user must enable this in Settings > Security > Device Administrators.
 */
class KioskDeviceAdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        Log.i("DeviceAdmin", "Device Admin enabled")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        Log.w("DeviceAdmin", "Device Admin disabled")
    }
}

private object Log {
    fun i(tag: String, msg: String) = android.util.Log.i(tag, msg)
    fun w(tag: String, msg: String) = android.util.Log.w(tag, msg)
}
