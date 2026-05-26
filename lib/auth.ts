import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions, User as AuthUser } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { compareSync, hashSync } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

async function ensureWorkspaceMembership(userId: string) {
  let calendar = await prisma.calendar.findFirst({
    where: { slug: "work" }
  });

  if (!calendar) {
    calendar = await prisma.calendar.create({
      data: {
        slug: "work",
        name: "Pracovní kalendář",
        description: "Sdílený pracovní kalendář",
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "OWNER"
          }
        }
      }
    });
    return calendar;
  }

  await prisma.calendarMember.upsert({
    where: {
      calendarId_userId: {
        calendarId: calendar.id,
        userId
      }
    },
    create: {
      calendarId: calendar.id,
      userId,
      role: calendar.ownerId === userId ? "OWNER" : "VIEWER"
    },
    update: {
      role: calendar.ownerId === userId ? "OWNER" : "VIEWER"
    }
  });

  return calendar;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Username and password",
      credentials: {
        username: { label: "Jméno", type: "text" },
        email: { label: "E-mail", type: "email" },
        password: { label: "Heslo", type: "password" },
        mode: { label: "Režim", type: "text" }
      },
      async authorize(credentials) {
        const username = normalizeUsername(String(credentials?.username ?? ""));
        const email = normalizeEmail(String(credentials?.email ?? ""));
        const password = String(credentials?.password ?? "");
        const mode = String(credentials?.mode ?? "login");

        if (!username || !password) {
          return null;
        }

        if (mode === "register") {
          const passwordHash = hashSync(password, 10);
          const existingByUsername = await prisma.user.findUnique({
            where: { username }
          });

          if (existingByUsername) {
            return null;
          }

          const existingByEmail = email
            ? await prisma.user.findUnique({
                where: { email }
              })
            : null;

          if (!existingByEmail) {
            const created = await prisma.user.create({
              data: {
                username,
                email: email || null,
                passwordHash,
                emailVerified: email ? new Date() : null
              }
            });

            await ensureWorkspaceMembership(created.id);
            return created;
          }

          if (existingByEmail.passwordHash || existingByEmail.username) {
            return null;
          }

          const updated = await prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              username,
              passwordHash,
              emailVerified: existingByEmail.emailVerified ?? (email ? new Date() : null)
            }
          });

          await ensureWorkspaceMembership(updated.id);
          return updated;
        }

        const existingUser = await prisma.user.findUnique({
          where: { username }
        });

        if (!existingUser?.passwordHash) {
          return null;
        }

        if (!compareSync(password, existingUser.passwordHash)) {
          return null;
        }

        return existingUser;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, username: true }
        });

        token.role = dbUser?.role ?? "USER";
        token.username = dbUser?.username ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user || !token.sub) {
        return session;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { role: true, username: true }
      });

      session.user.id = token.sub;
      session.user.role = dbUser?.role ?? (token.role as "USER" | "ADMIN" | undefined) ?? "USER";
      session.user.name = dbUser?.username ?? (token.username as string | null | undefined) ?? session.user.name ?? null;
      return session;
    }
  },
  events: {
    async signIn({ user }) {
      if (user.email && adminEmails.has(user.email.toLowerCase())) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" }
        });
      }
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};
