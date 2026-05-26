import { PrismaAdapter } from "@next-auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import type { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";

const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify-request"
  },
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM
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
    async createUser({ user }) {
      if (user.email && adminEmails.has(user.email.toLowerCase())) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" }
        });
      }

      if (!user.email) {
        return;
      }

      const invites = await prisma.invite.findMany({
        where: {
          email: user.email.toLowerCase(),
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
  },
  secret: process.env.NEXTAUTH_SECRET
};
