#!/usr/bin/env bash
# ============================================================
#  Kiosk Agent — compilar o APK e publicar num link de download
# ============================================================
#
#  COMO USAR (no seu computador, com Android Studio instalado):
#
#    cd android-reference
#    ./publish-apk.sh v1.0.0
#
#  O que o script faz:
#    1. Compila o APK (app-release.apk)
#    2. Copia para out/kiosk-agent.apk
#    3. Se a pasta estiver num repositório GitHub, cria a tag
#       e envia — o GitHub Actions (.github/workflows/build-apk.yml)
#       compila e publica a Release com o link de download público.
#
#  Pré-requisitos:
#    - Java 17+ e Android SDK (instalados pelo Android Studio)
#    - Para o link público: a pasta num repositório GitHub
#      (git remote -v deve mostrar a URL do GitHub)
# ============================================================

set -euo pipefail

VERSION="${1:-v1.0.0}"
OUT_DIR="out"
APK_OUT="$OUT_DIR/kiosk-agent.apk"

echo "==> Compilando APK (release)..."
if [ ! -x ./gradlew ]; then
  gradle wrapper --gradle-version 8.7
fi
./gradlew assembleRelease

mkdir -p "$OUT_DIR"
cp app/build/outputs/apk/release/app-release.apk "$APK_OUT"

echo ""
echo "✅ APK pronto: $APK_OUT"
echo ""

# Se houver repositório Git, cria a tag e dispara o build no GitHub
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
  if [[ "$REMOTE_URL" == *github.com* ]]; then
    echo "==> Repositório GitHub detectado: $REMOTE_URL"
    echo "==> Criando tag $VERSION e enviando para o GitHub..."
    git add -A
    git commit -m "release $VERSION" || echo "(nada novo para commitar)"
    git tag -fa "$VERSION" -m "Kiosk Agent $VERSION"
    git push origin HEAD --follow-tags --force-with-lease

    REPO_PATH="$(echo "$REMOTE_URL" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')"
    echo ""
    echo "🚀 Build iniciado no GitHub Actions."
    echo "   Acompanhe:  https://github.com/$REPO_PATH/actions"
    echo ""
    echo "   Quando terminar (~3 min), o link público de download será:"
    echo "   👉 https://github.com/$REPO_PATH/releases/download/$VERSION/kiosk-agent.apk"
    echo ""
    echo "   Envie esse link para o cliente — ele baixa e instala direto"
    echo "   no Android (precisa permitir 'instalar apps de fontes desconhecidas')."
  else
    echo "⚠️  Repositório Git sem remote do GitHub."
    echo "    Crie um repositório em https://github.com/new, rode:"
    echo "      git remote add origin <url-do-repo>"
    echo "    e execute este script de novo."
  fi
else
  echo "⚠️  Esta pasta não é um repositório Git."
  echo "    O APK local está em $APK_OUT — você pode enviá-lo por"
  echo "    e-mail/WhatsApp/Drive, ou rodar:"
  echo "      git init && git remote add origin <url-do-repo-github>"
  echo "    e executar este script de novo para gerar o link público."
fi
