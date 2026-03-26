#!/bin/bash
# =====================================================
# AgroDiary - Script de instalación en Ubuntu Server
# Para VM en ESXi con acceso por Tailscale
# =====================================================
set -e

echo "=========================================="
echo "  AgroDiary - Instalación en servidor"
echo "=========================================="

# --- Colores ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# --- Verificar root ---
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Ejecuta este script como root: sudo bash setup-vm.sh${NC}"
  exit 1
fi

# --- Variables ---
APP_USER="agrodiary"
APP_DIR="/opt/agrodiary"
NODE_VERSION="20"

echo ""
echo -e "${GREEN}[1/7] Actualizando sistema...${NC}"
apt update && apt upgrade -y

echo ""
echo -e "${GREEN}[2/7] Instalando dependencias del sistema...${NC}"
apt install -y curl git build-essential python3 sqlite3 open-vm-tools

echo ""
echo -e "${GREEN}[3/7] Instalando Node.js ${NODE_VERSION}...${NC}"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt install -y nodejs
else
  echo "Node.js ya instalado: $(node -v)"
fi

echo "Node: $(node -v)"
echo "npm: $(npm -v)"

echo ""
echo -e "${GREEN}[4/7] Instalando Tailscale...${NC}"
if ! command -v tailscale &> /dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
  echo -e "${YELLOW}Ejecuta después: sudo tailscale up${NC}"
else
  echo "Tailscale ya instalado"
  tailscale status || true
fi

echo ""
echo -e "${GREEN}[5/7] Creando usuario y directorio de la aplicación...${NC}"
if ! id "$APP_USER" &>/dev/null; then
  useradd -r -m -d /home/$APP_USER -s /bin/bash $APP_USER
  echo -e "${YELLOW}Usuario '$APP_USER' creado${NC}"
fi
mkdir -p $APP_DIR
chown $APP_USER:$APP_USER $APP_DIR

echo ""
echo -e "${GREEN}[6/7] Configurando firewall (UFW)...${NC}"
if command -v ufw &> /dev/null; then
  ufw allow ssh
  ufw allow 3000/tcp comment "AgroDiary"
  ufw --force enable
  echo "Firewall configurado (SSH + puerto 3000)"
else
  echo "UFW no instalado, saltando firewall"
fi

echo ""
echo -e "${GREEN}[7/7] Creando estructura de directorios...${NC}"
mkdir -p $APP_DIR/data
mkdir -p $APP_DIR/public/uploads
mkdir -p $APP_DIR/backups
chown -R $APP_USER:$APP_USER $APP_DIR

echo ""
echo "=========================================="
echo -e "${GREEN}  ¡Instalación base completada!${NC}"
echo "=========================================="
echo ""
echo "Próximos pasos:"
echo ""
echo "  1. Conectar Tailscale (si no lo has hecho):"
echo "     sudo tailscale up"
echo ""
echo "  2. Copiar el proyecto desde tu PC:"
echo "     Desde tu PC Windows, ejecuta:"
echo "     scp -r agrodiary/* agrodiary@<IP_VM>:/opt/agrodiary/"
echo ""
echo "  3. O bien clona desde git si tienes repo:"
echo "     su - agrodiary"
echo "     cd /opt/agrodiary && git clone <tu-repo> ."
echo ""
echo "  4. Instalar dependencias y compilar:"
echo "     su - agrodiary"
echo "     cd /opt/agrodiary"
echo "     npm install"
echo "     npm run build"
echo ""
echo "  5. Crear archivo .env.local:"
echo "     nano /opt/agrodiary/.env.local"
echo "     OPENAI_API_KEY=sk-..."
echo ""
echo "  6. Instalar el servicio systemd:"
echo "     sudo bash /opt/agrodiary/deploy/install-service.sh"
echo ""
echo "  7. (Opcional) Habilitar HTTPS con Tailscale:"
echo "     sudo tailscale cert <nombre>.tail708413.ts.net"
echo ""
