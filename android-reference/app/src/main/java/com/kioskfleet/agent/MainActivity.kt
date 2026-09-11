package com.kioskfleet.agent

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * Setup activity — shown once to configure backend URL and API key.
 * After setup, starts the foreground KioskService and hides.
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val existing = ApiClient.loadCredentials(this)
        if (existing != null) {
            startKiosk(existing.first, existing.second)
            return
        }

        setupUI()
    }

    private fun setupUI() {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }

        val title = TextView(this).apply {
            text = "KioskFleet Agent — Configuração"
            textSize = 20f
            setPadding(0, 0, 0, 32)
        }

        val urlLabel = TextView(this).apply { text = "URL do painel:" }
        val urlInput = EditText(this).apply {
            hint = "https://project--XXXX.lovable.app"
            setSingleLine()
        }

        val keyLabel = TextView(this).apply { text = "API Key do dispositivo:" }
        val keyInput = EditText(this).apply {
            hint = "kf_XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
            setSingleLine()
        }

        val saveBtn = Button(this).apply { text = "Registrar e Iniciar" }

        saveBtn.setOnClickListener {
            val url = urlInput.text.toString().trim().removeSuffix("/")
            val key = keyInput.text.toString().trim()

            if (url.isEmpty() || key.isEmpty()) {
                Toast.makeText(this, "Preencha URL e API Key", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            ApiClient.saveCredentials(this, url, key)
            startKiosk(url, key)
        }

        container.addView(title)
        container.addView(urlLabel)
        container.addView(urlInput)
        container.addView(keyLabel)
        container.addView(keyInput)
        container.addView(saveBtn)

        setContentView(container)
    }

    private fun startKiosk(url: String, key: String) {
        val intent = Intent(this, KioskService::class.java).apply {
            putExtra("base_url", url)
            putExtra("api_key", key)
        }
        startForegroundService(intent)
        finish() // Hide setup; service runs in background
    }
}
