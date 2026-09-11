package com.kioskfleet.agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream

/**
 * Screen capture service using MediaProjection API.
 * Captures the screen on demand and uploads JPEG to backend.
 *
 * Usage:
 *   1. User grants screen capture (MediaProjection) from MainActivity
 *   2. Service captures on ACTION_CAPTURE_NOW intent
 *   3. Captured JPEG uploaded via ApiClient.uploadScreenshot
 */
class ScreenCaptureService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var projectionCallback: MediaProjection.Callback? = null

    private lateinit var handlerThread: HandlerThread
    private lateinit var handler: Handler

    companion object {
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_RESULT_DATA = "result_data"
        const val ACTION_CAPTURE_NOW = "com.kioskfleet.agent.CAPTURE_NOW"
        const val ACTION_START_PROJECTION = "com.kioskfleet.agent.START_PROJECTION"
        private const val TAG = "ScreenCapture"
        private const val CHANNEL_ID = "kioskfleet_screen"
        private const val NOTIF_ID = 1002
        private const val WIDTH = 720
        private const val HEIGHT = 1280
        private const val DENSITY = 1 // VirtualDisplay VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR
    }

    override fun onCreate() {
        super.onCreate()
        handlerThread = HandlerThread("ScreenCapture").also { it.start() }
        handler = Handler(handlerThread.looper)
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_PROJECTION -> {
                val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
                val resultData = intent.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)
                if (resultData != null) {
                    startProjection(resultCode, resultData)
                } else {
                    Log.e(TAG, "No result data for projection")
                }
            }
            ACTION_CAPTURE_NOW -> {
                captureAndUpload()
            }
        }
        return START_STICKY
    }

    private fun startProjection(resultCode: Int, data: Intent) {
        val mgr = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = mgr.getMediaProjection(resultCode, data)

        projectionCallback = object : MediaProjection.Callback() {
            override fun onStop() {
                Log.d(TAG, "MediaProjection stopped")
                mediaProjection = null
            }
        }
        mediaProjection?.registerCallback(projectionCallback!!, handler)

        imageReader = ImageReader.newInstance(WIDTH, HEIGHT, PixelFormat.RGBA_8888, 2)
        imageReader?.setOnImageAvailableListener({ reader ->
            val image = reader.acquireLatestImage()
            if (image != null) {
                processImage(image)
            }
        }, handler)

        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "KioskFleetScreen",
            WIDTH, HEIGHT, resources.displayMetrics.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface, null, handler
        )
        Log.d(TAG, "MediaProjection started")
    }

    private fun processImage(image: Image) {
        try {
            val planes = image.planes
            val buffer = planes[0].buffer
            val pixelStride = planes[0].pixelStride
            val rowStride = planes[0].rowStride
            val rowPadding = rowStride - pixelStride * WIDTH

            val bitmap = Bitmap.createBitmap(
                WIDTH + rowPadding / pixelStride, HEIGHT,
                Bitmap.Config.ARGB_8888
            )
            bitmap.copyPixelsFromBuffer(buffer)

            // Crop to actual width
            val cropped = Bitmap.createBitmap(bitmap, 0, 0, WIDTH, HEIGHT)

            // Compress to JPEG
            val stream = ByteArrayOutputStream()
            cropped.compress(Bitmap.CompressFormat.JPEG, 70, stream)
            val jpegBytes = stream.toByteArray()

            // Upload
            val creds = ApiClient.loadCredentials(this)
            if (creds != null) {
                scope.launch {
                    try {
                        val client = ApiClient(creds.first, creds.second)
                        client.uploadScreenshot(jpegBytes)
                        Log.d(TAG, "Screenshot uploaded (${jpegBytes.size} bytes)")
                    } catch (e: Exception) {
                        Log.e(TAG, "Upload failed", e)
                    }
                }
            }

            bitmap.recycle()
            cropped.recycle()
        } catch (e: Exception) {
            Log.e(TAG, "Image processing failed", e)
        } finally {
            image.close()
        }
    }

    private fun captureAndUpload() {
        // The ImageReader listener handles capture automatically.
        // For on-demand capture, we can trigger by recreating the virtual display
        // or just rely on the continuous listener.
        if (mediaProjection == null) {
            Log.w(TAG, "MediaProjection not active — cannot capture")
            // In production: restart projection or notify panel
            return
        }
        // Force a new frame by toggling the virtual display
        virtualDisplay?.surface = imageReader?.surface
        Log.d(TAG, "Capture requested")
    }

    private fun buildNotification(): Notification {
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("KioskFleet — Screen Capture")
            .setContentText("Capturando tela para monitoramento remoto")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "KioskFleet Screen Capture",
                NotificationManager.IMPORTANCE_LOW
            )
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        virtualDisplay?.release()
        imageReader?.setOnImageAvailableListener(null, null)
        imageReader?.close()
        projectionCallback?.let { mediaProjection?.unregisterCallback(it) }
        mediaProjection?.stop()
        handlerThread.quitSafely()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
