package com.kioskfleet.agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Foreground service: the heart of the kiosk agent.
 * - Sends heartbeat every 30s
 * - Polls commands every 5s
 * - Collects telemetry every 60s
 * - Keeps device awake (partial wake lock)
 */
class KioskService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var apiClient: ApiClient
    private lateinit var commandExecutor: CommandExecutor
    private lateinit var wakeLock: PowerManager.WakeLock
    private val handler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "KioskService"
        private const val CHANNEL_ID = "kioskfleet_foreground"
        private const val NOTIF_ID = 1001

        private const val HEARTBEAT_INTERVAL = 30_000L
        private const val COMMAND_POLL_INTERVAL = 5_000L
        private const val TELEMETRY_INTERVAL = 60_000L
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "KioskFleet::AgentWake"
        )
        wakeLock.acquire(24 * 60 * 60 * 1000L) // 24h max, re-acquired on heartbeat
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val url = intent?.getStringExtra("base_url") ?: run {
            val creds = ApiClient.loadCredentials(this) ?: return START_NOT_STICKY
            creds.first
        }
        val key = intent?.getStringExtra("api_key") ?: run {
            val creds = ApiClient.loadCredentials(this) ?: return START_NOT_STICKY
            creds.second
        }

        apiClient = ApiClient(url, key)
        commandExecutor = CommandExecutor(this, apiClient)

        startForeground(NOTIF_ID, buildNotification("KioskFleet ativo"))

        startLoops()
        return START_STICKY
    }

    private fun startLoops() {
        // Heartbeat loop
        scope.launch {
            while (true) {
                try {
                    apiClient.heartbeat()
                    if (!wakeLock.isHeld) wakeLock.acquire(60 * 60 * 1000L)
                } catch (e: Exception) {
                    Log.w(TAG, "Heartbeat failed: ${e.message}")
                }
                delay(HEARTBEAT_INTERVAL)
            }
        }

        // Command polling loop
        scope.launch {
            while (true) {
                try {
                    val commands = apiClient.fetchCommands()
                    for (cmd in commands) {
                        commandExecutor.execute(cmd)
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Command poll failed: ${e.message}")
                }
                delay(COMMAND_POLL_INTERVAL)
            }
        }

        // Telemetry loop
        scope.launch {
            while (true) {
                try {
                    val telemetry = TelemetryCollector.collect(this@KioskService)
                    apiClient.sendTelemetry(telemetry)
                } catch (e: Exception) {
                    Log.w(TAG, "Telemetry failed: ${e.message}")
                }
                delay(TELEMETRY_INTERVAL)
            }
        }
    }

    private fun buildNotification(text: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("KioskFleet Agent")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "KioskFleet Foreground Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        scope.cancel()
        if (wakeLock.isHeld) wakeLock.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
