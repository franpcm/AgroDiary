#!/bin/bash
# =====================================================
# AgroDiary - Backup automático de datos
# Ejecutar con cron: 0 3 * * * /opt/agrodiary/deploy/backup.sh
# =====================================================
set -e

APP_DIR="/opt/agrodiary"
BACKUP_DIR="$APP_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Iniciando backup de AgroDiary..."

# 1. Backup de la base de datos SQLite (copia segura con WAL)
if [ -f "$APP_DIR/data/agrodiary.db" ]; then
  sqlite3 "$APP_DIR/data/agrodiary.db" ".backup '$BACKUP_DIR/agrodiary_$DATE.db'"
  echo "  ✓ Base de datos copiada"
fi

# 2. Backup de archivos subidos
if [ -d "$APP_DIR/public/uploads" ] && [ "$(ls -A $APP_DIR/public/uploads 2>/dev/null)" ]; then
  tar czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C "$APP_DIR/public" uploads/
  echo "  ✓ Archivos subidos empaquetados"
fi

# 3. Backup del .env.local
if [ -f "$APP_DIR/.env.local" ]; then
  cp "$APP_DIR/.env.local" "$BACKUP_DIR/env_$DATE.bak"
  echo "  ✓ Configuración copiada"
fi

# 4. Limpiar backups antiguos (más de N días)
find "$BACKUP_DIR" -name "agrodiary_*.db" -mtime +$KEEP_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +$KEEP_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "env_*.bak" -mtime +$KEEP_DAYS -delete 2>/dev/null || true
echo "  ✓ Backups antiguos limpiados (>$KEEP_DAYS días)"

echo "[$(date)] Backup completado → $BACKUP_DIR"
