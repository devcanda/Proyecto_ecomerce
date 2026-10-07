// Comprueba que la tienda puede conectarse a la base de datos
import pg from "pg"

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
try {
  await client.connect()
  const { rows } = await client.query("select current_database() as db, version() as v")
  console.log(`Conexion correcta a "${rows[0].db}" (${rows[0].v.split(",")[0]})`)
} catch (error) {
  console.error(`No se pudo conectar a la base de datos: ${error.message}`)
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
