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

function parseEventDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function getEventForManagement(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: {
      calendar: {
        include: {
          members: true
        }
      }
    }
  });
}

function canManageEvent(
  user: Awaited<ReturnType<typeof requireUser>>,
  event: NonNullable<Awaited<ReturnType<typeof getEventForManagement>>>
) {
  const membership = event.calendar.members.find((member) => member.userId === user.id);

  return (
    user.role === "ADMIN" ||
    membership?.role === "OWNER" ||
    membership?.role === "EDITOR" ||
    event.createdById === user.id
  );
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
  const eventDate = String(formData.get("eventDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const attributedToUserId = String(formData.get("attributedToUserId") ?? "");
  const attributedToName = String(formData.get("attributedToName") ?? "").trim();
  const resolvedStartsAt = startsAt || (eventDate && startTime ? `${eventDate}T${startTime}` : "");
  const resolvedEndsAt = endsAt || (eventDate && endTime ? `${eventDate}T${endTime}` : "");

  if (!calendarId || !title || !resolvedStartsAt || !resolvedEndsAt) {
    return;
  }

  const startDate = new Date(resolvedStartsAt);
  const endDate = new Date(resolvedEndsAt);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate < startDate
  ) {
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
  const canCreate = user.role === "ADMIN" || Boolean(membership);

  if (!canCreate) {
    return;
  }

  let attributedToUserIdValue: string | null = null;
  let attributedToNameValue: string | null = null;

  if (user.role === "ADMIN" || membership?.role === "EDITOR" || membership?.role === "OWNER") {
    if (attributedToName) {
      attributedToNameValue = attributedToName;
      await prisma.calendarAttributedName.upsert({
        where: {
          calendarId_name: {
            calendarId,
            name: attributedToName
          }
        },
        create: {
          calendarId,
          name: attributedToName
        },
        update: {}
      });
    } else if (attributedToUserId.startsWith("name:")) {
      const decodedName = decodeURIComponent(attributedToUserId.slice("name:".length)).trim();

      if (!decodedName) {
        return;
      }

      attributedToNameValue = decodedName;
      await prisma.calendarAttributedName.upsert({
        where: {
          calendarId_name: {
            calendarId,
            name: decodedName
          }
        },
        create: {
          calendarId,
          name: decodedName
        },
        update: {}
      });
    } else if (attributedToUserId) {
      const targetMember = calendar.members.find((member) => member.userId === attributedToUserId);

      if (!targetMember) {
        return;
      }

      attributedToUserIdValue = targetMember.userId;
    }
  }

  await prisma.event.create({
    data: {
      calendarId,
      title,
      description: description || null,
      location: location || null,
      startsAt: startDate,
      endsAt: endDate,
      createdById: user.id,
      attributedToUserId: attributedToUserIdValue,
      attributedToName: attributedToNameValue
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

  const event = await getEventForManagement(eventId);

  if (!event) {
    return;
  }

  if (!canManageEvent(user, event)) {
    return;
  }

  await prisma.event.delete({
    where: { id: eventId }
  });

  revalidatePath("/dashboard");
}

export async function updateEvent(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");

  if (!eventId || !title || !eventDate || !startTime || !endTime) {
    return;
  }

  const event = await getEventForManagement(eventId);

  if (!event || !canManageEvent(user, event)) {
    return;
  }

  const startDate = parseEventDate(`${eventDate}T${startTime}`);
  const endDate = parseEventDate(`${eventDate}T${endTime}`);

  if (!startDate || !endDate || endDate < startDate) {
    return;
  }

  await prisma.event.update({
    where: { id: eventId },
    data: {
      title,
      description: description || null,
      location: location || null,
      startsAt: startDate,
      endsAt: endDate
    }
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

export async function updateUserRole(formData: FormData) {
  const user = await requireUser();
  const targetUserId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  const calendar = await getWorkspaceCalendar();
  const membership = calendar.members.find((member) => member.userId === user.id);
  const canManage = user.role === "ADMIN" || membership?.role === "OWNER";

  if (!canManage) {
    return;
  }

  if (!targetUserId || (role !== "USER" && role !== "ADMIN")) {
    return;
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { role }
  });

  revalidatePath("/dashboard");
}
