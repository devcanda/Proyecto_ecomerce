// Crea/actualiza las tablas aplicando prisma/migrations directamente con PostgreSQL.
// Reemplaza "prisma migrate deploy" en hostings compartidos, donde el motor de Prisma no arranca.
// Usa la misma tabla _prisma_migrations, asi que es compatible con Prisma.
// Uso: node migrar.mjs   (lee DATABASE_URL de ../.env si no esta en el entorno)
import { createHash, randomUUID } from "node:crypto"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const here = dirname(fileURLToPath(import.meta.url))

if (!process.env.DATABASE_URL) {
  const envFile = join(here, "..", ".env")
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, "utf8").split(/\r?\n/).find((item) => item.startsWith("DATABASE_URL="))
    if (line) process.env.DATABASE_URL = line.slice("DATABASE_URL=".length).trim()
  }
}
if (!process.env.DATABASE_URL) {
  console.error("ERROR: falta DATABASE_URL (ejecuta primero instalar.sh)")
  process.exit(1)
}

const migrationsDir = join(here, "prisma", "migrations")
const migrations = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(migrationsDir, entry.name, "migration.sql")))
  .map((entry) => entry.name)
  .sort()

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )`)

  // Un paso que quedo a medias (por ejemplo, interrumpido) se marca como revertido y se vuelve a aplicar.
  // Cada paso corre dentro de una transaccion, asi que si no termino no dejo cambios.
  const stuck = await client.query(
    `UPDATE "_prisma_migrations" SET rolled_back_at = now()
     WHERE finished_at IS NULL AND rolled_back_at IS NULL RETURNING migration_name`
  )
  for (const row of stuck.rows) console.log(`Paso incompleto anterior, se reintenta: ${row.migration_name}`)

  const { rows } = await client.query(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
  )
  const applied = new Set(rows.map((row) => row.migration_name))
  const pending = migrations.filter((name) => !applied.has(name))

  console.log(`${migrations.length} pasos en total, ${applied.size} ya aplicados, ${pending.length} por aplicar`)

  for (const name of pending) {
    const sql = readFileSync(join(migrationsDir, name, "migration.sql"), "utf8")
    const checksum = createHash("sha256").update(sql).digest("hex")
    const id = randomUUID()
    process.stdout.write(`Aplicando ${name}... `)
    await client.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count)
       VALUES ($1, $2, $3, now(), 0)`,
      [id, checksum, name]
    )
    try {
      await client.query("BEGIN")
      await client.query(sql)
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      await client.query(`UPDATE "_prisma_migrations" SET logs = $2 WHERE id = $1`, [id, String(error.message)])
      console.log("ERROR")
      console.error(`No se pudo aplicar ${name}: ${error.message}`)
      process.exit(1)
    }
    await client.query(
      `UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1`,
      [id]
    )
    console.log("ok")
  }

  console.log(pending.length ? "Base de datos lista." : "La base de datos ya estaba al dia.")
} finally {
  await client.end()
}
