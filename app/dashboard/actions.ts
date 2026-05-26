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

export async function createCalendar(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const color = String(formData.get("color") ?? "#5ce1c7").trim();

  if (!name) {
    return;
  }

  await prisma.calendar.create({
    data: {
      name,
      description: description || null,
      color,
      ownerId: user.id,
      members: {
        create: {
          userId: user.id,
          role: "OWNER"
        }
      }
    }
  });

  revalidatePath("/dashboard");
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
          OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }]
        }
  });

  if (!calendar) {
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
