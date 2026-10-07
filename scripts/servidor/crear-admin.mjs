// Crea (o actualiza la contrasena de) un usuario administrador.
// Lo usa instalar.sh: recibe los datos por variables de entorno para no dejarlos en el historial.
import { randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import pg from "pg"

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = process.env
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Faltan datos para crear el administrador.")
  process.exit(1)
}

const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()
try {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const result = await client.query(
    `INSERT INTO users (id, email, password, name, role, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE', now(), now())
     ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = 'ADMIN', status = 'ACTIVE', "updatedAt" = now()
     RETURNING (xmax = 0) AS created`,
    [randomUUID(), ADMIN_EMAIL.trim().toLowerCase(), hash, (ADMIN_NAME || "Administrador").trim()]
  )
  console.log(result.rows[0].created ? `Administrador creado: ${ADMIN_EMAIL}` : `Administrador actualizado: ${ADMIN_EMAIL}`)
} finally {
  await client.end()
}
