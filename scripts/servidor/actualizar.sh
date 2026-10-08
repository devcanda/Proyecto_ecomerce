#!/bin/bash
# Actualiza la tienda instalada en ~/tienda con una version nueva.
# Pasos (Terminal de cPanel):
#   1) Subir el .tar.gz a la carpeta personal (/home/USUARIO)
#   2) rm -rf ~/tienda-nueva && mkdir ~/tienda-nueva && tar -xzf ~/compraenlinea-tienda-XXXX.tar.gz -C ~/tienda-nueva --strip-components=1
#   3) bash ~/tienda-nueva/instalacion/actualizar.sh
# Se conservan: ~/tienda/.env (configuracion), ~/tienda/storage (fotos) y el enlace node_modules de CloudLinux.
set -e
NUEVA="$(cd "$(dirname "$0")/.." && pwd)"
APP="${APP_DIR:-$HOME/tienda}"

# Node.js 22 del servidor (sin el npm "controlado" de CloudLinux)
[ -d /opt/alt/alt-nodejs22/root/usr/bin ] && export PATH=/opt/alt/alt-nodejs22/root/usr/bin:$PATH
command -v node >/dev/null 2>&1 || { echo "ERROR: no se encuentra Node.js"; exit 1; }

[ "$NUEVA" != "$APP" ] || { echo "ERROR: ejecuta este script desde la version nueva (~/tienda-nueva), no desde ~/tienda"; exit 1; }
[ -f "$APP/.env" ] || { echo "ERROR: no existe $APP/.env (la tienda no esta instalada todavia)"; exit 1; }
{ [ -f "$NUEVA/server.js" ] && [ -d "$NUEVA/_modulos" ]; } || { echo "ERROR: el paquete esta incompleto"; exit 1; }

echo "=== Actualizando la tienda en $APP (Node.js $(node -v)) ==="

# 1. Base de datos primero: si algo falla aqui, la tienda actual sigue funcionando sin cambios
echo; echo "--- Base de datos ---"
DATABASE_URL="$(grep '^DATABASE_URL=' "$APP/.env" | head -1 | cut -d= -f2-)"
( cd "$NUEVA/instalacion" && DATABASE_URL="$DATABASE_URL" node migrar.mjs )

# 2. Librerias: en CloudLinux node_modules es un enlace a la carpeta del entorno virtual
if [ -L "$APP/node_modules" ]; then MODS="$(readlink -f "$APP/node_modules")"; else MODS="$APP/node_modules"; fi
echo; echo "--- Librerias ($MODS) ---"
mkdir -p "$MODS"
find "$MODS" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "$NUEVA/_modulos/." "$MODS/"
echo "ok"

# 3. Codigo de la tienda (no se tocan .env, storage ni node_modules)
echo; echo "--- Codigo nuevo ---"
for item in server.js package.json .next public instalacion; do
  rm -rf "${APP:?}/$item"
  cp -a "$NUEVA/$item" "$APP/$item"
done
mkdir -p "$APP/storage/uploads" "$APP/tmp"
echo "ok"

# 4. Reinicio (Passenger reinicia la aplicacion al ver este archivo)
touch "$APP/tmp/restart.txt"
rm -rf "$NUEVA"

echo
echo "=== Actualizacion terminada ==="
echo "Toca RESTART en cPanel > Setup Node.js App y abre la tienda."
