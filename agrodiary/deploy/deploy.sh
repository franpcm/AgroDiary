#!/bin/bash
# =====================================================
# AgroDiary - Compilar y desplegar (ejecutar como agrodiary)
# =====================================================
set -e

APP_DIR="/opt/agrodiary"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$APP_DIR"

echo -e "${GREEN}[1/4] Instalando dependencias...${NC}"
npm ci --production=false

echo ""
echo -e "${GREEN}[2/4] Compilando aplicación...${NC}"
npm run build

echo ""
echo -e "${GREEN}[3/4] Preparando standalone...${NC}"
# Next.js standalone necesita los archivos estáticos y públicos
cp -r public .next/standalone/public 2>/dev/null || true
cp -r .next/static .next/standalone/.next/static 2>/dev/null || true

# Enlace simbólico para que la BBDD y uploads sean accesibles desde standalone
ln -sfn "$APP_DIR/data" .next/standalone/data
ln -sfn "$APP_DIR/public/uploads" .next/standalone/public/uploads 2>/dev/null || true

echo ""
echo -e "${GREEN}[4/4] Reiniciando servicio...${NC}"
sudo systemctl restart agrodiary

echo ""
sleep 2
if systemctl is-active --quiet agrodiary; then
  echo -e "${GREEN}✓ AgroDiary desplegado y funcionando${NC}"
  echo ""
  echo "Accede en: http://$(hostname):3000"
  TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "")
  if [ -n "$TAILSCALE_IP" ]; then
    TAILSCALE_NAME=$(tailscale status --json 2>/dev/null | grep -o '"DNSName":"[^"]*"' | head -1 | cut -d'"' -f4 | sed 's/\.$//')
    echo "Tailscale:  http://$TAILSCALE_IP:3000"
    [ -n "$TAILSCALE_NAME" ] && echo "            https://$TAILSCALE_NAME:3000"
  fi
else
  echo -e "${YELLOW}⚠ El servicio no arrancó. Revisa los logs:${NC}"
  echo "  sudo journalctl -u agrodiary -n 50 --no-pager"
fi
echo ""
