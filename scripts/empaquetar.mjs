// Arma el paquete para subir la tienda al hosting (cPanel con Node.js).
// Uso: npm run empaquetar
// Resultado: deploy/compraenlinea-tienda-AAAAMMDD-HHMM.tar.gz
//
// El paquete NO incluye el .env ni las fotos locales (storage/): el servidor tiene los suyos
// y no se tocan al subir una version nueva.

import { execSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const out = join(root, "deploy")
const app = join(out, "tienda")
const run = (command, cwd = root) => execSync(command, { cwd, stdio: "inherit" })
const step = (text) => console.log(`\n=== ${text} ===`)

step("1/6 Construyendo la tienda")
run("npx next build")

step("2/6 Copiando la version empaquetada")
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
// dereference: copia el contenido real de los enlaces simbolicos que deja Next.js (Windows no deja recrearlos)
cpSync(join(root, ".next", "standalone"), app, { recursive: true, dereference: true })
cpSync(join(root, ".next", "static"), join(app, ".next", "static"), { recursive: true })
cpSync(join(root, "public"), join(app, "public"), { recursive: true })
// Nunca subir claves locales ni fotos de prueba
for (const name of [".env", ".env.local", "storage"]) rmSync(join(app, name), { recursive: true, force: true })

step("3/6 Agregando el procesador de fotos para Linux (sharp)")
const sharpVersion = JSON.parse(readFileSync(join(root, "node_modules", "sharp", "package.json"), "utf8")).version
const tmp = join(out, ".sharp-linux")
mkdirSync(tmp, { recursive: true })
writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "sharp-linux", private: true }))
run(`npm install --no-audit --no-fund --os=linux --cpu=x64 --libc=glibc sharp@${sharpVersion}`, tmp)
rmSync(join(app, "node_modules", "@img"), { recursive: true, force: true })
cpSync(join(tmp, "node_modules", "@img"), join(app, "node_modules", "@img"), { recursive: true })
rmSync(tmp, { recursive: true, force: true })

step("4/6 Agregando el instalador de la base de datos")
const setup = join(app, "instalacion")
mkdirSync(setup, { recursive: true })
cpSync(join(root, "prisma", "schema.prisma"), join(setup, "prisma", "schema.prisma"))
cpSync(join(root, "prisma", "migrations"), join(setup, "prisma", "migrations"), { recursive: true })
cpSync(join(root, "scripts", "servidor"), setup, { recursive: true })
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const dep = (name) => pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]
writeFileSync(
  join(setup, "package.json"),
  JSON.stringify(
    {
      name: "compraenlinea-instalacion",
      private: true,
      type: "module",
      // Sin el motor de Prisma: las tablas se crean con migrar.mjs (el motor no arranca en hostings compartidos)
      dependencies: { pg: dep("pg"), bcryptjs: dep("bcryptjs") },
    },
    null,
    2
  )
)

step("5/6 Comprimiendo")
const now = new Date()
const pad = (n) => String(n).padStart(2, "0")
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
const file = `compraenlinea-tienda-${stamp}.tar.gz`
// tar de Windows guarda las rutas con "/" (compatibles con Linux)
run(`tar -czf "${file}" tienda`, out)

step("6/6 Listo")
const size = (Number(execSync(`powershell -NoProfile -Command "(Get-Item '${join(out, file)}').Length"`).toString()) / 1024 / 1024).toFixed(1)
console.log(`Paquete: deploy/${file} (${size} MB)`)
if (!existsSync(join(app, "server.js"))) throw new Error("Falta server.js en el paquete")
