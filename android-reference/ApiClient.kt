package com.kioskfleet.agent

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * HTTP client for KioskFleet backend.
 * All device-to-server communication goes through here.
 */
class ApiClient(
    private val baseUrl: String,
    private val apiKey: String,
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = false }
    private val mediaType = "application/json".toMediaType()

    private fun request(path: String, body: String): Request {
        return Request.Builder()
            .url("$baseUrl$path")
            .header("X-Device-Key", apiKey)
            .header("Content-Type", "application/json")
            .post(body.toRequestBody(mediaType))
            .build()
    }

    /** Heartbeat: updates last_seen_at and gets online status */
    suspend fun heartbeat(): HeartbeatResponse = withContext(Dispatchers.IO) {
        val body = buildJsonObject { put("status", "online") }.toString()
        val res = client.newCall(request("/api/public/device/heartbeat", body)).execute()
        if (!res.isSuccessful) throw Exception("Heartbeat failed: ${res.code}")
        json.decodeFromString(res.body!!.string())
    }

    /** Poll pending commands */
    suspend fun fetchCommands(): List<DeviceCommand> = withContext(Dispatchers.IO) {
        val body = buildJsonObject {}.toString()
        val res = client.newCall(request("/api/public/device/commands", body)).execute()
        if (!res.isSuccessful) throw Exception("Commands fetch failed: ${res.code}")
        val text = res.body!!.string()
        if (text.isBlank()) return@withContext emptyList()
        json.decodeFromString(text)
    }

    /** Report command result */
    suspend fun reportCommandResult(
        commandId: String,
        status: String,
        output: String? = null,
    ) = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("command_id", commandId)
            put("status", status)
            output?.let { put("output", it) }
        }.toString()
        val res = client.newCall(request("/api/public/device/command-result", body)).execute()
        if (!res.isSuccessful) throw Exception("Command result report failed: ${res.code}")
    }

    /** Upload screenshot (raw bytes) */
    suspend fun uploadScreenshot(
        jpegBytes: ByteArray,
    ) = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$baseUrl/api/public/device/screenshot")
            .header("X-Device-Key", apiKey)
            .header("Content-Type", "image/jpeg")
            .post(jpegBytes.toRequestBody("image/jpeg".toMediaType()))
            .build()
        val res = client.newCall(req).execute()
        if (!res.isSuccessful) throw Exception("Screenshot upload failed: ${res.code}")
    }

    /** Send telemetry */
    suspend fun sendTelemetry(telemetry: TelemetryPayload) = withContext(Dispatchers.IO) {
        val body = json.encodeToString(TelemetryPayload.serializer(), telemetry)
        val res = client.newCall(request("/api/public/device/telemetry", body)).execute()
        if (!res.isSuccessful) throw Exception("Telemetry send failed: ${res.code}")
    }

    @Serializable
    data class HeartbeatResponse(val ok: Boolean = false)

    @Serializable
    data class DeviceCommand(
        val id: String,
        val command_type: String,
        val payload: String? = null,
    )

    @Serializable
    data class TelemetryPayload(
        val battery_level: Int? = null,
        val battery_charging: Boolean? = null,
        val cpu_usage: Double? = null,
        val memory_used_mb: Long? = null,
        val memory_total_mb: Long? = null,
        val storage_used_mb: Long? = null,
        val storage_total_mb: Long? = null,
        val current_app: String? = null,
        val network_type: String? = null,
        val ip_address: String? = null,
        val latitude: Double? = null,
        val longitude: Double? = null,
        val wifi_strength: Int? = null,
        val uptime_seconds: Long? = null,
        val android_version: String? = null,
        val model: String? = null,
    )

    companion object {
        private const val TAG = "ApiClient"

        /** Load credentials from encrypted prefs */
        fun loadCredentials(context: Context): Pair<String, String>? {
            val prefs = context.getSharedPreferences("kioskfleet", Context.MODE_PRIVATE)
            val url = prefs.getString("base_url", null) ?: return null
            val key = prefs.getString("api_key", null) ?: return null
            return Pair(url, key)
        }

        fun saveCredentials(context: Context, baseUrl: String, apiKey: String) {
            context.getSharedPreferences("kioskfleet", Context.MODE_PRIVATE)
                .edit()
                .putString("base_url", baseUrl)
                .putString("api_key", apiKey)
                .apply()
        }
    }
}
