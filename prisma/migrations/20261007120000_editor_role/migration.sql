-- Nuevo rol: editor de productos (solo crea y edita productos desde el panel)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EDITOR';
