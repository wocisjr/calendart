"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const attributedToId = String(formData.get("attributedToId") ?? "");
  const actorName = String(formData.get("actorName") ?? "").trim();

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

  let actorId: string | null = null;

  if (user.role === "ADMIN") {
    if (attributedToId === "__new__") {
      if (!actorName) {
        return;
      }

      const actor = await prisma.calendarActor.upsert({
        where: {
          calendarId_name: {
            calendarId,
            name: actorName
          }
        },
        update: {},
        create: {
          calendarId,
          name: actorName,
          createdById: user.id
        }
      });

      actorId = actor.id;
    } else if (attributedToId) {
      const actor = await prisma.calendarActor.findFirst({
        where: {
          id: attributedToId,
          calendarId
        }
      });

      actorId = actor?.id ?? null;
    }
  }

  await prisma.event.create({
    data: {
      calendarId,
      title,
      description: description || null,
      location: location || null,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      createdById: user.id,
      attributedToId: actorId
    }
  });

  revalidatePath("/dashboard");
}

export async function removeEvent(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");

  if (!eventId) {
    return;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      calendar: {
        include: {
          members: true
        }
      }
    }
  });

  if (!event) {
    return;
  }

  const membership = event.calendar.members.find((member) => member.userId === user.id);
  const canManage = user.role === "ADMIN" || membership?.role === "OWNER" || membership?.role === "EDITOR";

  if (!canManage) {
    return;
  }

  await prisma.event.delete({
    where: { id: eventId }
  });

  revalidatePath("/dashboard");
}

export async function removeCalendarMember(formData: FormData) {
  const user = await requireUser();
  const memberId = String(formData.get("memberId") ?? "");

  if (!memberId) {
    return;
  }

  const calendar = await getWorkspaceCalendar();
  const membership = calendar.members.find((member) => member.userId === user.id);
  const canManage = user.role === "ADMIN" || membership?.role === "OWNER";

  if (!canManage) {
    return;
  }

  const targetMember = calendar.members.find((member) => member.id === memberId);

  if (!targetMember || targetMember.userId === calendar.ownerId) {
    return;
  }

  await prisma.calendarMember.delete({
    where: { id: memberId }
  });

  revalidatePath("/dashboard");
}

export async function updateCalendarMemberRole(formData: FormData) {
  const user = await requireUser();
  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!memberId || !role || (role !== "VIEWER" && role !== "EDITOR")) {
    return;
  }

  const calendar = await getWorkspaceCalendar();
  const membership = calendar.members.find((member) => member.userId === user.id);
  const canManage = user.role === "ADMIN" || membership?.role === "OWNER";

  if (!canManage) {
    return;
  }

  const targetMember = calendar.members.find((member) => member.id === memberId);

  if (!targetMember || targetMember.userId === calendar.ownerId) {
    return;
  }

  await prisma.calendarMember.update({
    where: { id: memberId },
    data: {
      role
    }
  });

  revalidatePath("/dashboard");
}
