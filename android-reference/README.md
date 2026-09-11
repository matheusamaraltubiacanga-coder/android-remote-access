# KioskFleet Android — App de Referência

App Android para controle remoto de dispositivos em modo kiosk (lojas, quiosques).
Este é **código de referência** — não é compilado pelo projeto web. Copie para Android Studio.

## Pré-requisitos

- Android Studio (Arctic Fox+)
- Android 10+ (API 29) — MediaProjection e AccessibilityService
- Dispositivo com Google Play Services (não obrigatório)

## Configuração

1. **No painel web (KioskFleet):**
   - Cadastre um dispositivo → copie a **API Key** gerada
   - Anote a URL do backend (ex: `https://project--XXXX.lovable.app`)

2. **No app Android:**
   - Cole a API Key e URL em `MainActivity` ou via `BuildConfig`
   - Compile e instale no dispositivo

3. **Permissões necessárias (conceder manualmente):**
   - Accessibility Service (Configurações → Acessibilidade)
   - Screen Capture (MediaProjection — concede em runtime)
   - Overlay/Display over other apps
   - Device Admin (para lock/wipe)
   - Notificações (foreground service)

## Arquitetura

```
┌─────────────────────────────────────────┐
│           KioskService (Foreground)      │
│  • Heartbeat a cada 30s                  │
│  • Poll de comandos a cada 5s            │
│  • Executa comandos via CommandExecutor  │
│  • Coleta telemetria a cada 60s          │
└──────────┬──────────────┬───────────────┘
           │              │
   ┌───────▼────┐  ┌─────▼──────────┐
   │ScreenCapture│  │RemoteControl   │
   │  Service    │  │  (Accessibility)│
   │MediaProj    │  │  Gestures/Input │
   │Screenshot   │  │  App switching  │
   └─────────────┘  └────────────────┘
```

## Funcionalidades

| Comando       | Descrição                          |
|---------------|------------------------------------|
| `lock`        | Bloqueia tela (Device Admin)       |
| `reboot`      | Reinicia (requer root ou Device Admin) |
| `screenshot`  | Captura tela atual                 |
| `install_app` | Instala APK remoto                 |
| `uninstall_app` | Remove pacote                    |
| `launch_app`  | Abre app por package name          |
| `set_kiosk_mode` | Ativa/desativa modo quiosk      |
| `update_policy` | Baixa e aplica política kiosk    |
| `send_message` | Exibe mensagem na tela           |

## Segurança

- API Key armazenada em `EncryptedSharedPreferences`
- Comunicação via HTTPS
- Device Admin para operações privilegiadas
- App não funciona sem registro prévio no painel
