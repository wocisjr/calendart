import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions, User as AuthUser } from "next-auth";
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

async function applyPendingInvites(user: Pick<AuthUser, "id" | "email">) {
  if (!user.email) {
    return;
  }

  const invites = await prisma.invite.findMany({
    where: {
      email: normalizeEmail(user.email),
      status: "PENDING",
      expiresAt: {
        gt: new Date()
      }
    }
  });

  for (const invite of invites) {
    if (!invite.calendarId) {
      continue;
    }

    await prisma.calendarMember.upsert({
      where: {
        calendarId_userId: {
          calendarId: invite.calendarId,
          userId: user.id
        }
      },
      create: {
        calendarId: invite.calendarId,
        userId: user.id,
        role: invite.role
      },
      update: {
        role: invite.role
      }
    });

    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" }
    });
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
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
            return prisma.user.create({
              data: {
                username,
                email,
                passwordHash,
                emailVerified: new Date()
              }
            });
          }

          if (existingByEmail.passwordHash || existingByEmail.username) {
            return null;
          }

          return prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              username,
              passwordHash,
              emailVerified: existingByEmail.emailVerified ?? new Date()
            }
          });
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
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true }
        });
        session.user.role = dbUser?.role ?? "USER";
      }
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

      await applyPendingInvites(user);
    },
    async createUser({ user }) {
      if (user.email && adminEmails.has(user.email.toLowerCase())) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" }
        });
      }

      await applyPendingInvites(user);
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};
