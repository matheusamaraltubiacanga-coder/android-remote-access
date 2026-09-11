# KioskFleet Agent — App Android (modelo para gerar APK)

Este diretório é um projeto **Android Studio** pronto para abrir, compilar e
gerar o APK que será instalado nos aparelhos da loja. Ele conversa com o
painel web que você já tem publicado.

> Importante: gerar o `.apk` acontece no computador do cliente (Android
> Studio), não neste ambiente. Aqui está o código-fonte completo do app.

---

## 1. O que o app faz

- Roda como serviço em primeiro plano (não é morto pelo Android).
- Envia batimento (`heartbeat`) e telemetria (bateria, memória, versão…).
- Recebe comandos do painel: **capturar tela, toque, deslizar, tecla
  (voltar/home/recentes), bloquear, reiniciar, instalar/desinstalar app,
  abrir app, mensagem, brilho, volume, kiosk**.
- Envia a captura da tela para o painel (base64 PNG).
- Executa toques, deslizes e teclas usando o serviço de **Acessibilidade**.
- Reinicia sozinho após o boot do aparelho.

## 2. Requisitos no computador para gerar o APK

- **Android Studio Koala (2024.1) ou superior** — https://developer.android.com/studio
- **JDK 17** (o Android Studio já vem com ele embutido).
- Um cabo USB para instalar o APK, ou uma rede local para o aparelho baixar.

## 3. Como abrir e gerar o APK (passo a passo)

1. Baixe esta pasta `android-reference/` inteira do projeto e renomeie para
   `KioskFleetAgent`.
2. No Android Studio: **File → Open** e escolha a pasta `KioskFleetAgent`.
3. Aguarde o "Gradle sync" terminar (baixa dependências, ~2 minutos na
   primeira vez).
4. **Build → Generate Signed App Bundle / APK… → APK**.
5. Crie uma **keystore** nova (guarde a senha; ela é obrigatória em todas as
   atualizações futuras).
6. Escolha **release** e conclua. O APK final fica em
   `app/release/app-release.apk`.
7. Envie esse `.apk` para os aparelhos (WhatsApp, e-mail, link de download,
   Google Drive, etc.).

## 4. Como instalar no aparelho Android

1. No aparelho: **Configurações → Segurança → Fontes desconhecidas** —
   permita a instalação vinda do app pelo qual o APK foi baixado
   (Chrome/Files/WhatsApp).
2. Abra o `.apk` baixado e toque em **Instalar**.
3. Abra o app **KioskFleet Agent**.

## 5. Autorizações que o app pede (na primeira vez)

Precisam ser concedidas nesta ordem, e o próprio app abre as telas
corretas:

1. **Sobrepor a outros apps** (para mensagens e modo kiosk).
2. **Notificações** (o Android exige para serviços em primeiro plano).
3. **Serviço de Acessibilidade "KioskFleet Agent"** — ative a chave.
   Isto é o que permite ao painel enviar **toques, deslizes, voltar,
   home e recentes**.
4. **Administrador de dispositivo** — necessário para **bloquear** e
   **reiniciar** remotamente.
5. **Captura de tela** — na primeira captura solicitada pelo painel o
   Android mostra uma janela pedindo permissão; toque em **Iniciar agora**.
   Marque "Não perguntar de novo" quando aparecer.

## 6. Ligar o aparelho ao painel

Ao abrir o app pela primeira vez, informe:

- **URL do backend** — copie do painel: use o endereço que aparece na barra
  do navegador (por exemplo `https://seuapp.lovable.app`), sem barra no
  final.
- **Chave do aparelho** — no painel, cadastre o aparelho na loja e copie a
  chave que aparece. Cole aqui.

Toque em **Registrar**. Em segundos ele aparece **online** no painel.

## 7. Usar controle remoto no painel

1. Abra o painel → **Aparelhos** → clique no aparelho desejado.
2. Toque em **Capturar tela** para ver a tela atual.
3. Na imagem da tela, **clique** = toque simples; **arraste** = deslizar;
   **segure** = pressionar longo.
4. Botões abaixo da imagem: **Voltar, Home, Recentes**.
5. Outros comandos ficam no painel lateral (bloquear, reiniciar, mensagem,
   volume, kiosk, etc.).

## 8. Modo kiosk (loja)

Quando o kiosk está ligado no painel, o app bloqueia a saída dos aplicativos
autorizados: se o usuário abrir qualquer outro app, o serviço de
acessibilidade envia **Home** imediatamente. Para desligar, alterne a chave
**Kiosk** no cabeçalho do aparelho no painel.

## 9. Problemas comuns

- **"Aparelho offline"** — o app foi encerrado ou perdeu internet. Reabra
  ou reinicie o aparelho — ele volta sozinho após o boot.
- **Toques não funcionam** — o serviço de Acessibilidade não está ativado.
  Refaça o passo 5.3.
- **Bloqueio/reboot não funciona** — Administrador de dispositivo não foi
  ativado (passo 5.4).
- **Captura falha** — negue e conceda novamente a permissão de captura;
  em alguns fabricantes é preciso desativar a bateria otimizada para o app.

## 10. Estrutura do código (referência técnica)

```text
app/src/main/
  AndroidManifest.xml
  java/com/kioskfleet/agent/
    MainActivity.kt              # tela de configuração (URL + chave)
    KioskApp.kt                  # Application (estado global)
    KioskService.kt              # foreground service (heartbeat + polling)
    ApiClient.kt                 # HTTP para o backend
    CommandExecutor.kt           # executa cada comando recebido
    RemoteControlService.kt      # AccessibilityService (toques/gestos/teclas)
    ScreenCaptureService.kt      # MediaProjection → PNG base64 → upload
    TelemetryCollector.kt        # coleta bateria/memória/rede/etc.
    KioskDeviceAdminReceiver.kt  # DeviceAdmin (lock/reboot)
    BootReceiver.kt              # reinicia serviço após boot
  res/xml/
    accessibility_config.xml
    device_admin_policies.xml
```

Endpoints do backend consumidos (todos em `/api/public/device/*`):

| Método | Rota                | Uso                        |
| ------ | ------------------- | -------------------------- |
| POST   | `/heartbeat`        | Marca aparelho online      |
| GET    | `/commands`         | Baixa comandos pendentes   |
| POST   | `/command-result`   | Reporta resultado          |
| POST   | `/telemetry`        | Envia telemetria           |
| POST   | `/screenshot`       | Envia captura (base64 PNG) |

Todos usam o header `X-Device-Key: <chave-do-aparelho>`.

## Publicar o APK num link de download

Rode no computador (com Android Studio instalado):

```bash
cd android-reference
./publish-apk.sh v1.0.0
```

O script compila o APK e, se a pasta estiver num repositório GitHub,
cria a tag e dispara o GitHub Actions (`.github/workflows/build-apk.yml`),
que publica a Release com link público:

```
https://github.com/<seu-usuario>/<repo>/releases/download/v1.0.0/kiosk-agent.apk
```

Envie esse link ao cliente — ele baixa e instala direto no Android
(é preciso permitir "instalar apps de fontes desconhecidas").
