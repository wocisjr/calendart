"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { randomUUID } from "crypto";

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return session.user;
}

export async function getWorkspaceCalendar() {
  const existing = await prisma.calendar.findFirst({
    where: { slug: "work" },
    include: {
      members: {
        include: {
          user: true
        }
      }
    }
  });

  if (existing) {
    return existing;
  }

  throw new Error("Workspace calendar does not exist yet.");
}

export async function ensureWorkspaceCalendar() {
  const user = await requireUser();
  await getOrCreateWorkspaceCalendar(user.id);
}

export async function getOrCreateWorkspaceCalendar(userId: string) {
  let calendar = await prisma.calendar.findFirst({
    where: { slug: "work" }
  });

  if (!calendar) {
    calendar = await prisma.calendar.create({
      data: {
        slug: "work",
        name: "Work calendar",
        description: "Shared team calendar",
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "OWNER"
          }
        }
      }
    });
  }

  return calendar;
}

export async function createEvent(formData: FormData) {
  const user = await requireUser();
  const calendarId = String(formData.get("calendarId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");

  if (!calendarId || !title || !startsAt || !endsAt) {
    return;
  }

  const calendar = await prisma.calendar.findFirst({
    where: user.role === "ADMIN"
      ? { id: calendarId }
      : {
          id: calendarId,
          members: {
            some: { userId: user.id }
          }
        },
    include: {
      members: true
    }
  });

  if (!calendar) {
    return;
  }

  const membership = calendar.members.find((member) => member.userId === user.id);
  const canCreate = user.role === "ADMIN" || !membership || membership.role !== "VIEWER";

  if (!canCreate) {
    return;
  }

  await prisma.event.create({
    data: {
      calendarId,
      title,
      description: description || null,
      location: location || null,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      createdById: user.id
    }
  });

  revalidatePath("/dashboard");
}

export async function shareCalendarAccess(formData: FormData) {
  const user = await requireUser();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "VIEWER");

  if (!email) {
    return;
  }

  const calendar = await getWorkspaceCalendar();
  const membership = calendar.members.find((member) => member.userId === user.id);
  const canShare = user.role === "ADMIN" || membership?.role === "OWNER" || membership?.role === "EDITOR";

  if (!canShare) {
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    await prisma.calendarMember.upsert({
      where: {
        calendarId_userId: {
          calendarId: calendar.id,
          userId: existingUser.id
        }
      },
      create: {
        calendarId: calendar.id,
        userId: existingUser.id,
        role: role === "EDITOR" ? "EDITOR" : "VIEWER"
      },
      update: {
        role: role === "EDITOR" ? "EDITOR" : "VIEWER"
      }
    });

    await sendMail({
      to: email,
      subject: "You have access to the work calendar",
      text: `You were granted access to the shared work calendar. Sign in with this email to see it in the app.`,
      html: `<p>You were granted access to the shared work calendar.</p><p>Sign in with this email to see it in the app.</p>`
    });
  } else {
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.invite.create({
      data: {
        email,
        token,
        role: role === "EDITOR" ? "EDITOR" : "VIEWER",
        calendarId: calendar.id,
        invitedById: user.id,
        expiresAt
      }
    });

    await sendMail({
      to: email,
      subject: "You have access to the work calendar",
      text: `You were added to the shared work calendar. Open the app, sign in with this email, and the access will be applied automatically.`,
      html: `<p>You were added to the shared work calendar.</p><p>Open the app and sign in with this email. Once the account exists, access will be applied automatically.</p>`
    });
  }

  revalidatePath("/dashboard");
}
