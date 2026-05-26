import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEvent, getOrCreateWorkspaceCalendar, shareCalendarAccess } from "./actions";
import { LogoutButton } from "@/app/logout-button";

type WorkspaceCalendar = Prisma.CalendarGetPayload<{
  include: {
    owner: true;
    members: {
      include: {
        user: true;
      };
    };
  };
}>;

type WorkspaceEvent = Prisma.EventGetPayload<{
  include: {
    createdBy: true;
  };
}>;

function parseDateInput(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const offset = (day + 6) % 7;
  result.setDate(result.getDate() - offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toDateTimeLocal(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result.toISOString().slice(0, 16);
}

function formatWeekLabel(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "short"
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function formatDayTitle(date: Date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatAddedAt(date: Date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function groupByDay(events: WorkspaceEvent[]) {
  return events.reduce<Record<string, WorkspaceEvent[]>>((acc, event) => {
    const key = toDayKey(new Date(event.startsAt));
    (acc[key] ??= []).push(event);
    return acc;
  }, {});
}

export default async function DashboardPage({
  searchParams
}: Readonly<{
  searchParams?: Promise<{ day?: string }>;
}>) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const calendar = await getOrCreateWorkspaceCalendar(session.user.id);
  const loadedCalendar = await prisma.calendar.findFirst({
    where: { id: calendar.id },
    include: {
      owner: true,
      members: {
        include: {
          user: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!loadedCalendar) {
    throw new Error("Workspace calendar could not be initialized.");
  }

  const calendarData = loadedCalendar as WorkspaceCalendar;
  const userMembership = calendarData.members.find((member) => member.userId === session.user.id);
  const isAllowed =
    session.user.role === "ADMIN" ||
    calendarData.ownerId === session.user.id ||
    Boolean(userMembership);
  const canManage = session.user.role === "ADMIN" || userMembership?.role === "OWNER" || userMembership?.role === "EDITOR";

  if (!isAllowed) {
    return (
      <main className="shell">
        <section className="panel" style={{ maxWidth: 560, margin: "80px auto 0" }}>
          <div className="panel-title">Access pending</div>
          <h1 className="panel-heading">You are not yet on the shared calendar.</h1>
          <p className="copy">
            Ask the calendar owner or an admin to share access with your email, then sign in again.
          </p>
          <div className="nav-actions" style={{ marginTop: 16 }}>
            <Link className="button-ghost" href="/login">
              Back to login
            </Link>
            <LogoutButton />
          </div>
        </section>
      </main>
    );
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedDate = parseDateInput(resolvedSearchParams.day) ?? new Date();
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = addDays(weekStart, 7);

  const events = await prisma.event.findMany({
    where: {
      calendarId: calendarData.id,
      startsAt: {
        gte: weekStart,
        lt: weekEnd
      }
    },
    include: {
      createdBy: true
    },
    orderBy: [
      { startsAt: "asc" },
      { createdAt: "asc" }
    ]
  });

  const eventsByDay = groupByDay(events);
  const selectedDayKey = toDayKey(selectedDate);
  const selectedDayEvents = eventsByDay[selectedDayKey] ?? [];
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const selectedDayInput = toDateTimeLocal(selectedDate, "09:00");
  const selectedDayEndInput = toDateTimeLocal(selectedDate, "10:00");
  const memberCount = calendarData.members.length;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span>◫</span>
          </div>
          <div>
            <div>Work calendar</div>
            <div className="muted" style={{ fontSize: "0.88rem" }}>
              Shared team calendar
            </div>
          </div>
        </div>
        <div className="nav-actions">
          <span className="badge">{memberCount} members</span>
          <Link className="button-ghost" href="/">
            Home
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="toolbar">
        <div>
          <div className="toolbar-title">Week view</div>
          <div className="muted">{formatWeekLabel(weekStart, weekEnd)}</div>
        </div>

        <div className="nav-actions">
          <Link className="button-ghost" href={`/dashboard?day=${toDayKey(addDays(weekStart, -7))}`}>
            Prev week
          </Link>
          <Link className="button-ghost" href={`/dashboard?day=${toDayKey(new Date())}`}>
            Today
          </Link>
          <Link className="button-ghost" href={`/dashboard?day=${toDayKey(addDays(weekStart, 7))}`}>
            Next week
          </Link>
        </div>
      </section>

      <section className="calendar-layout">
        <div className="calendar-board">
          <div className="week-grid">
            {weekDays.map((day) => {
              const dayKey = toDayKey(day);
              const dayEvents = eventsByDay[dayKey] ?? [];
              const isSelected = dayKey === selectedDayKey;

              return (
                <Link
                  key={dayKey}
                  href={`/dashboard?day=${dayKey}`}
                  className={`day-card ${isSelected ? "day-card--selected" : ""}`}
                >
                  <div className="day-head">
                    <div>
                      <div className="day-label">{formatDayTitle(day)}</div>
                      <div className="muted">{dayEvents.length} events</div>
                    </div>
                    <span className="day-number">{day.getDate()}</span>
                  </div>

                  <div className="day-events">
                    {dayEvents.length ? (
                      dayEvents.slice(0, 4).map((event) => (
                        <article className="event-chip" key={event.id}>
                          <div className="event-chip__time">{formatTime(new Date(event.startsAt))}</div>
                          <div className="event-chip__title">{event.title}</div>
                          <div className="event-chip__meta">
                            {event.createdBy.name || event.createdBy.email || "Unknown"} · {formatTime(new Date(event.createdAt))}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="empty-day">No events yet</div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="sidebar">
          <section className="panel">
            <div className="panel-title">Selected day</div>
            <h2 className="panel-heading">{formatDayTitle(selectedDate)}</h2>

            {selectedDayEvents.length ? (
              <div className="event-list">
                {selectedDayEvents.map((event) => (
                  <article className="event-item" key={event.id}>
                    <div className="event-item__top">
                      <strong>{event.title}</strong>
                      <span className="badge">{formatTime(new Date(event.startsAt))}</span>
                    </div>
                    {event.location ? <div className="muted">{event.location}</div> : null}
                    {event.description ? <div className="copy">{event.description}</div> : null}
                    <div className="event-meta">
                      Added by {event.createdBy.name || event.createdBy.email || "Unknown"} on {formatAddedAt(new Date(event.createdAt))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">No events for this day.</div>
            )}
          </section>

          <section className="panel">
            <div className="panel-title">Add event</div>
            <form className="form-grid" action={createEvent}>
              <input type="hidden" name="calendarId" value={calendarData.id} />
              <div>
                <label className="label" htmlFor="event-title">
                  Title
                </label>
                <input id="event-title" name="title" className="field" placeholder="Standup" required />
              </div>
              <div className="inline-fields">
                <div>
                  <label className="label" htmlFor="startsAt">
                    Start
                  </label>
                  <input id="startsAt" name="startsAt" className="field" type="datetime-local" defaultValue={selectedDayInput} required />
                </div>
                <div>
                  <label className="label" htmlFor="endsAt">
                    End
                  </label>
                  <input id="endsAt" name="endsAt" className="field" type="datetime-local" defaultValue={selectedDayEndInput} required />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="event-location">
                  Location
                </label>
                <input id="event-location" name="location" className="field" placeholder="Room A / Meet" />
              </div>
              <div>
                <label className="label" htmlFor="event-description">
                  Notes
                </label>
                <textarea id="event-description" name="description" className="textarea" placeholder="Optional notes" />
              </div>
              <button className="button-accent" type="submit" disabled={!canManage}>
                {canManage ? "Add event" : "View only"}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-title">Share access</div>
            <div className="muted" style={{ marginBottom: 12 }}>
              Invite people to the shared work calendar by email.
            </div>
            <form className="form-grid" action={shareCalendarAccess}>
              <div>
                <label className="label" htmlFor="share-email">
                  Email
                </label>
                <input id="share-email" name="email" className="field" type="email" placeholder="name@company.com" required />
              </div>
              <div>
                <label className="label" htmlFor="share-role">
                  Access level
                </label>
                <select id="share-role" name="role" className="select" defaultValue="VIEWER">
                  <option value="VIEWER">Viewer</option>
                  <option value="EDITOR">Editor</option>
                </select>
              </div>
              <button className="button-ghost" type="submit" disabled={!canManage}>
                {canManage ? "Share access" : "Owner only"}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-title">Members</div>
            <div className="member-list">
              {calendarData.members.map((member) => (
                <article className="member-pill" key={member.id}>
                  <div>
                    <strong>{member.user.name || member.user.email || "Unknown"}</strong>
                    <div className="muted">{member.user.email}</div>
                  </div>
                  <span className="badge">{member.role}</span>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
