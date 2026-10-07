#!/bin/bash
# Despues de subir una version nueva: aplica los cambios de la base de datos.
# Uso: cd ~/tienda/instalacion && bash actualizar.sh   (y luego RESTART en Setup Node.js App)
set -e
cd "$(dirname "$0")"
ENV_FILE="$(cd .. && pwd)/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: falta $ENV_FILE. Ejecuta primero instalar.sh"
  exit 1
fi
export DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)
echo "--- Instalando herramientas ---"
npm install --no-audit --no-fund --omit=dev
echo "--- Aplicando cambios de la base de datos ---"
node migrar.mjs
mkdir -p "$(cd .. && pwd)/storage/uploads"
echo "Listo. Ahora toca RESTART en cPanel > Setup Node.js App."
