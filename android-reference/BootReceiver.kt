package com.kioskfleet.agent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Starts KioskService on device boot.
 * Ensures the agent is always running after a reboot.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val creds = ApiClient.loadCredentials(context)
            if (creds != null) {
                val serviceIntent = Intent(context, KioskService::class.java).apply {
                    putExtra("base_url", creds.first)
                    putExtra("api_key", creds.second)
                }
                context.startForegroundService(serviceIntent)
                Log.i("BootReceiver", "KioskService started on boot")
            } else {
                Log.w("BootReceiver", "No credentials — skipping service start")
            }
        }
    }
}

private object Log {
    fun i(tag: String, msg: String) = android.util.Log.i(tag, msg)
    fun w(tag: String, msg: String) = android.util.Log.w(tag, msg)
}
