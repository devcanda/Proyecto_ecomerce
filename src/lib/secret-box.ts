import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

// Cifra claves de API antes de guardarlas en la base de datos (AES-256-GCM).
// La llave sale de AUTH_SECRET: si esa variable cambia, hay que volver a escribir las claves en el panel.
function key() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("Falta AUTH_SECRET para cifrar las claves")
  return createHash("sha256").update(`app-settings:${secret}`).digest()
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":")
}

// null si no se puede descifrar (por ejemplo, si cambio AUTH_SECRET)
export function decryptSecret(sealed?: string | null): string | null {
  if (!sealed) return null
  const [version, iv, tag, data] = sealed.split(":")
  if (version !== "v1" || !iv || !tag || !data) return null
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"))
    decipher.setAuthTag(Buffer.from(tag, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}
