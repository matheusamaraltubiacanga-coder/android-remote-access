package com.kioskfleet.agent

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * AccessibilityService for remote control of the device.
 *
 * Capabilities:
 * - Tap/swipe gestures (dispatchGesture)
 * - Navigate to home / recents / back
 * - Force-stop apps (via Settings UI navigation)
 * - Detect foreground app changes
 * - Enforce kiosk mode (block exits from allowed apps)
 *
 * The service reads commands from a shared queue populated by KioskService.
 */
class RemoteControlService : AccessibilityService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var lastForegroundApp: String? = null

    companion object {
        private const val TAG = "RemoteControl"

        @Volatile private var instance: RemoteControlService? = null

        /** Pending gesture to execute (set by CommandExecutor) */
        @Volatile
        var pendingGesture: GestureRequest? = null

        /** Pending key action (back, home, recents) */
        @Volatile
        var pendingKeyAction: String? = null

        /** Allowed packages in kiosk mode */
        var allowedPackages: Set<String> = emptySet()

        /** Kiosk mode enforcement active */
        var enforceKiosk: Boolean = false

        /** Execute any pending gesture/key immediately without waiting for an a11y event. */
        fun wake() {
            instance?.drainPending()
        }
    }

    data class GestureRequest(
        val type: String, // "tap", "swipe", "long_press"
        val x: Float,
        val y: Float,
        val endX: Float? = null,
        val endY: Float? = null,
        val duration: Long = 300,
    )

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                val pkg = event.packageName?.toString()
                if (pkg != null && pkg != lastForegroundApp) {
                    lastForegroundApp = pkg
                    Log.d(TAG, "Foreground app changed: $pkg")

                    // Kiosk mode enforcement: if not in allowed list, go back home
                    if (enforceKiosk && pkg !in allowedPackages && pkg != androidPackage) {
                        Log.w(TAG, "Blocked app in kiosk mode: $pkg")
                        performGlobalAction(GLOBAL_ACTION_HOME)
                    }
                }
            }
        }

        // Execute pending gesture
        pendingGesture?.let { gesture ->
            pendingGesture = null
            executeGesture(gesture)
        }

        // Execute pending key action
        pendingKeyAction?.let { action ->
            pendingKeyAction = null
            when (action) {
                "back" -> performGlobalAction(GLOBAL_ACTION_BACK)
                "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
                "recents" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
                "notifications" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
                "quick_settings" -> performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
            }
        }
    }

    private fun executeGesture(req: GestureRequest) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return

        val path = Path()
        path.moveTo(req.x, req.y)
        if (req.endX != null && req.endY != null) {
            path.lineTo(req.endX, req.endY)
        }

        val stroke = GestureDescription.StrokeDescription(
            path, 0, req.duration
        )
        val gesture = GestureDescription.Builder()
            .addStroke(stroke)
            .build()

        val dispatched = dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gesture: GestureDescription?) {
                Log.d(TAG, "Gesture completed: ${req.type}")
            }
            override fun onCancelled(gesture: GestureDescription?) {
                Log.w(TAG, "Gesture cancelled: ${req.type}")
            }
        }, null)

        if (!dispatched) {
            Log.w(TAG, "Gesture dispatch failed: ${req.type}")
        }
    }

    /**
     * Force stop an app by navigating to Settings.
     * Requires accessibility service to traverse the Settings UI.
     */
    fun forceStopApp(packageName: String) {
        val intent = android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            .setData(android.net.Uri.parse("package:$packageName"))
            .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(intent)

        // Wait for UI, then find and click "Force Stop"
        scope.launch {
            kotlinx.coroutines.delay(2000)
            val root = rootInActiveWindow ?: return@launch
            findAndClickByText(root, "Force stop")
            kotlinx.coroutines.delay(500)
            findAndClickByText(root, "OK")
        }
    }

    private fun findAndClickByText(root: AccessibilityNodeInfo?, text: String) {
        if (root == null) return
        val nodes = root.findAccessibilityNodeInfosByText(text)
        for (node in nodes) {
            var clickable = node
            while (clickable != null && !clickable.isClickable) {
                clickable = clickable.parent
            }
            clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            break
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i(TAG, "RemoteControlService connected — ready for gestures and enforcement")
    }

    private val androidPackage = "com.android.settings"
}
