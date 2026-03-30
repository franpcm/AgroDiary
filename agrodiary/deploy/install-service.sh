#!/bin/bash
# =====================================================
# Instalar servicio systemd de AgroDiary
# =====================================================
set -e

GREEN='\033[0;32m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
  echo "Ejecuta como root: sudo bash install-service.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${GREEN}Instalando servicio systemd...${NC}"

# Copiar archivo de servicio
cp "$SCRIPT_DIR/agrodiary.service" /etc/systemd/system/agrodiary.service

# Recargar systemd
systemctl daemon-reload

# Habilitar inicio automático
systemctl enable agrodiary

# Iniciar el servicio
systemctl start agrodiary

echo ""
echo -e "${GREEN}¡Servicio instalado y arrancado!${NC}"
echo ""
echo "Comandos útiles:"
echo "  sudo systemctl status agrodiary    - Ver estado"
echo "  sudo systemctl restart agrodiary   - Reiniciar"
echo "  sudo systemctl stop agrodiary      - Parar"
echo "  sudo journalctl -u agrodiary -f    - Ver logs en vivo"
echo ""
