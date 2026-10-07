#!/bin/bash
# Crea otro administrador o cambia la contrasena de uno existente.
# Uso: cd ~/tienda/instalacion && bash crear-admin.sh
set -e
cd "$(dirname "$0")"
export DATABASE_URL=$(grep '^DATABASE_URL=' ../.env | head -1 | cut -d= -f2-)
[ -d node_modules ] || npm install --no-audit --no-fund --omit=dev
read -r -p "Correo del administrador: " ADMIN_EMAIL
read -r -p "Nombre [Administrador]: " ADMIN_NAME
read -r -s -p "Contrasena (minimo 8 caracteres): " ADMIN_PASSWORD; echo
[ "${#ADMIN_PASSWORD}" -ge 8 ] || { echo "Muy corta."; exit 1; }
ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_NAME="$ADMIN_NAME" ADMIN_PASSWORD="$ADMIN_PASSWORD" node crear-admin.mjs
