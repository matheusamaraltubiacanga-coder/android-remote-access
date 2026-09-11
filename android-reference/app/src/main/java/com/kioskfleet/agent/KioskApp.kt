package com.kioskfleet.agent

import android.app.Application
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.util.Log

/**
 * Application class — holds global kiosk state and provides accessors.
 */
class KioskApp : Application() {

    companion object {
        private const val TAG = "KioskApp"

        /** Global kiosk mode flag (set remotely via command) */
        @Volatile
        var kioskModeEnabled: Boolean = false

        /** Default allowed packages in kiosk mode */
        val defaultAllowedPackages = setOf(
            "com.android.settings",
            "com.android.systemui",
            // Add your kiosk app package here
        )

        private lateinit var instance: KioskApp

        fun get(): KioskApp = instance
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.i(TAG, "KioskFleet Agent started")
    }

    /**
     * Check if Device Admin is active.
     */
    fun isDeviceAdminActive(): Boolean {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val component = ComponentName(this, KioskDeviceAdminReceiver::class.java)
        return dpm.isAdminActive(component)
    }

    /**
     * Enable kiosk mode by setting a restrictive DevicePolicyManager configuration.
     * This prevents the user from leaving the designated kiosk app.
     */
    fun enableKioskMode(allowedPackage: String) {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val component = ComponentName(this, KioskDeviceAdminReceiver::class.java)

        if (!dpm.isAdminActive(component)) {
            Log.w(TAG, "Device Admin not active — cannot enable full kiosk mode")
            return
        }

        try {
            // Disable camera
            dpm.setCameraDisabled(component, true)
            // Lock task features (Android 9+)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                dpm.setLockTaskPackages(component, arrayOf(allowedPackage))
            }
            kioskModeEnabled = true
            Log.i(TAG, "Kiosk mode enabled for $allowedPackage")
        } catch (e: SecurityException) {
            Log.e(TAG, "Failed to enable kiosk mode", e)
        }
    }

    fun disableKioskMode() {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val component = ComponentName(this, KioskDeviceAdminReceiver::class.java)

        if (!dpm.isAdminActive(component)) return

        try {
            dpm.setCameraDisabled(component, false)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                dpm.setLockTaskPackages(component, arrayOf())
            }
            kioskModeEnabled = false
            Log.i(TAG, "Kiosk mode disabled")
        } catch (e: SecurityException) {
            Log.e(TAG, "Failed to disable kiosk mode", e)
        }
    }
}
