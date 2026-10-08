import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { normalizeEmail } from "./roles"

// Cada cuanto se vuelve a revisar en la base de datos el rol y el estado de un usuario con sesion abierta
// (asi un usuario borrado, desactivado o con otro rol pierde el acceso sin esperar a que venza la sesion)
const SESSION_RECHECK_MS = 30_000

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // El correo se guarda en minusculas: "Juan@Email.com" y "juan@email.com" son el mismo
        const user = await prisma.user.findUnique({
          where: { email: normalizeEmail(credentials.email as string) },
        })

        // Solo los usuarios activos pueden iniciar sesion
        if (!user || user.status !== "ACTIVE") {
          return null
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!passwordMatch) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role as string
        token.checkedAt = Date.now()
        return token
      }
      if (!token.id || Date.now() - Number(token.checkedAt ?? 0) < SESSION_RECHECK_MS) return token

      const current = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { role: true, status: true, name: true, email: true },
      })
      // Usuario borrado o desactivado: la sesion se cierra
      if (!current || current.status !== "ACTIVE") return null
      token.role = current.role
      token.name = current.name
      token.email = current.email
      token.checkedAt = Date.now()
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
})
