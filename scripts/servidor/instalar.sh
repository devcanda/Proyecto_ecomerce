#!/bin/bash
# Instalacion inicial de la tienda en el servidor (se ejecuta una sola vez).
# Uso (desde la Terminal de cPanel, con el entorno de Node activado):
#   cd ~/tienda/instalacion && bash instalar.sh
set -e
cd "$(dirname "$0")"
APP_DIR="$(cd .. && pwd)"
ENV_FILE="$APP_DIR/.env"
DOMINIO="https://compraenlinea.store"

echo "=== Instalacion de Compra En Linea ==="

# 1. Node.js del entorno de la aplicacion
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: no se encuentra Node.js. Activa primero el entorno (comando 'source .../activate' de Setup Node.js App)."
  exit 1
fi
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: se necesita Node.js 20 o superior (tienes $(node -v)). Elige la version 22 en Setup Node.js App."
  exit 1
fi
echo "Node.js $(node -v)"

# 2. Herramientas de instalacion
echo; echo "--- Instalando herramientas (puede tardar 1-2 minutos) ---"
npm install --no-audit --no-fund --omit=dev

# 3. Datos de la base de datos
echo; echo "--- Base de datos PostgreSQL ---"
read -r -p "Usuario de la base [compraenlinea_tienda]: " DB_USER; DB_USER=${DB_USER:-compraenlinea_tienda}
read -r -p "Nombre de la base [compraenlinea_tienda1]: " DB_NAME; DB_NAME=${DB_NAME:-compraenlinea_tienda1}
read -r -s -p "Contrasena del usuario de la base (no se ve al escribir): " DB_PASS; echo
DB_PASS_ENC=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$DB_PASS")
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS_ENC}@127.0.0.1:5432/${DB_NAME}"
node probar-conexion.mjs

# 4. Archivo de configuracion de la tienda (solo lo puede leer tu usuario)
if [ -f "$ENV_FILE" ] && grep -q '^AUTH_SECRET=' "$ENV_FILE"; then
  AUTH_SECRET=$(grep '^AUTH_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2-)
else
  AUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
fi
umask 077
cat > "$ENV_FILE" <<CONF
# Configuracion de la tienda en el servidor (creada por instalar.sh). No compartir este archivo.
DATABASE_URL=${DATABASE_URL}
AUTH_SECRET=${AUTH_SECRET}
AUTH_TRUST_HOST=true
AUTH_URL=${DOMINIO}
NEXT_PUBLIC_APP_URL=${DOMINIO}
CONF
chmod 600 "$ENV_FILE"
echo "Configuracion guardada en $ENV_FILE"

# 5. Tablas de la base de datos
echo; echo "--- Creando las tablas ---"
node migrar.mjs

# 6. Carpeta de fotos
mkdir -p "$APP_DIR/storage/uploads"

# 7. Administrador
echo; echo "--- Usuario administrador ---"
read -r -p "Correo del administrador: " ADMIN_EMAIL
read -r -p "Nombre del administrador [Administrador]: " ADMIN_NAME
while true; do
  read -r -s -p "Contrasena (minimo 8 caracteres, no se ve al escribir): " ADMIN_PASSWORD; echo
  read -r -s -p "Repite la contrasena: " ADMIN_PASSWORD2; echo
  if [ "${#ADMIN_PASSWORD}" -lt 8 ]; then echo "Muy corta, intenta de nuevo."
  elif [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD2" ]; then echo "No coinciden, intenta de nuevo."
  else break; fi
done
ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_NAME="$ADMIN_NAME" ADMIN_PASSWORD="$ADMIN_PASSWORD" node crear-admin.mjs

echo
echo "=== Instalacion terminada ==="
echo "Ahora ve a cPanel > Setup Node.js App y toca RESTART en la aplicacion."
echo "Luego abre ${DOMINIO}"
