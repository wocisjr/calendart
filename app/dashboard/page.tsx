import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendar, createEvent } from "./actions";
import { LogoutButton } from "@/app/logout-button";

type CalendarWithRelations = Prisma.CalendarGetPayload<{
  include: {
    owner: true;
    events: {
      include: {
        createdBy: true;
      };
    };
  };
}>;

type EventWithCalendar = Prisma.EventGetPayload<{
  include: {
    calendar: true;
  };
}>;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

async function ensureDefaultCalendar(userId: string) {
  const existing = await prisma.calendar.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return existing;
  }

  return prisma.calendar.create({
    data: {
      name: "Personal",
      description: "Default calendar",
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

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  await ensureDefaultCalendar(session.user.id);

  const isAdmin = session.user.role === "ADMIN";

  const calendars: CalendarWithRelations[] = await prisma.calendar.findMany({
    where: isAdmin
      ? {}
      : {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } }
          ]
        },
    include: {
      owner: true,
      events: {
        orderBy: { startsAt: "asc" },
        take: 5,
        include: {
          createdBy: true
        }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  const upcomingEvents: EventWithCalendar[] = await prisma.event.findMany({
    where: isAdmin
      ? {}
      : {
          calendar: {
            OR: [
              { ownerId: session.user.id },
              { members: { some: { userId: session.user.id } } }
            ]
          }
        },
    include: {
      calendar: true
    },
    orderBy: { startsAt: "asc" },
    take: 20
  });

  const monthDays = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index - 2);
    return date;
  });

  const calendarCount = calendars.length;
  const eventCount = upcomingEvents.length;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span>◫</span>
          </div>
          <div>
            <div>Dashboard</div>
            <div className="muted" style={{ fontSize: "0.88rem" }}>
              {session.user.email}
            </div>
          </div>
        </div>
        <div className="nav-actions">
          <span className="badge">{session.user.role}</span>
          <Link className="button-ghost" href="/">
            Home
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="hero" style={{ marginBottom: 24 }}>
        <div>
          <span className="kicker">Running in a container · MySQL · PWA</span>
          <h1>Kalendář pro práci, bez zbytečné váhy.</h1>
          <p className="hero-copy">
            {isAdmin
              ? "Jsi admin, takže vidíš celý tým. Tady můžeš rozšiřovat správu kalendářů, sdílení a eventy."
              : "Tohle je tvoje pracovní plocha. Vlastní kalendáře, sdílené kalendáře a rychlé vytvoření eventu."}
          </p>
        </div>
        <div className="hero-panel">
          <div className="stat">
            <strong>{calendarCount}</strong>
            <span className="muted">kalendáře dostupné pro účet.</span>
          </div>
          <div className="stat">
            <strong>{eventCount}</strong>
            <span className="muted">nadcházejících eventů v systému.</span>
          </div>
        </div>
      </section>

      <section className="page-grid">
        <div className="stack">
          <article className="section">
            <h2>New calendar</h2>
            <form className="form-grid" action={createCalendar}>
              <div>
                <label className="label" htmlFor="calendar-name">
                  Name
                </label>
                <input id="calendar-name" name="name" className="field" placeholder="Team calendar" required />
              </div>
              <div>
                <label className="label" htmlFor="calendar-description">
                  Description
                </label>
                <textarea
                  id="calendar-description"
                  name="description"
                  className="textarea"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="label" htmlFor="calendar-color">
                  Color
                </label>
                <input
                  id="calendar-color"
                  name="color"
                  className="field"
                  type="color"
                  defaultValue="#5ce1c7"
                  style={{ padding: 6, height: 48, width: 88 }}
                />
              </div>
              <button className="button-accent" type="submit">
                Create calendar
              </button>
            </form>
          </article>

          <article className="section">
            <h2>Quick event</h2>
            <form className="form-grid" action={createEvent}>
              <div>
                <label className="label" htmlFor="calendarId">
                  Calendar
                </label>
                <select id="calendarId" name="calendarId" className="select" required defaultValue={calendars[0]?.id}>
                  {calendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </option>
                  ))}
                </select>
              </div>
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
                  <input id="startsAt" name="startsAt" className="field" type="datetime-local" required />
                </div>
                <div>
                  <label className="label" htmlFor="endsAt">
                    End
                  </label>
                  <input id="endsAt" name="endsAt" className="field" type="datetime-local" required />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="event-location">
                  Location
                </label>
                <input id="event-location" name="location" className="field" placeholder="Room A / Google Meet" />
              </div>
              <div>
                <label className="label" htmlFor="event-description">
                  Description
                </label>
                <textarea id="event-description" name="description" className="textarea" placeholder="Optional notes" />
              </div>
              <button className="button-accent" type="submit">
                Create event
              </button>
            </form>
          </article>
        </div>

        <div className="stack">
          <section className="section">
            <h2>Month view</h2>
            <div className="calendar-grid">
              {monthDays.map((date) => {
                const dayEvents = upcomingEvents.filter((event) => {
                  const eventDate = new Date(event.startsAt);
                  return eventDate.toDateString() === date.toDateString();
                });

                return (
                  <div className="day" key={date.toISOString()}>
                    <div className="day-head">
                      <strong className="day-number">{date.getDate()}</strong>
                      <span className="muted">{date.toLocaleDateString("cs-CZ", { weekday: "short" })}</span>
                    </div>
                    {dayEvents.length ? (
                      dayEvents.slice(0, 3).map((event) => (
                        <div className="event-pill" key={event.id}>
                          {event.title}
                          <small>{formatDate(new Date(event.startsAt))}</small>
                        </div>
                      ))
                    ) : (
                      <div className="muted" style={{ fontSize: "0.9rem" }}>
                        No events
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="section">
            <h2>Calendars</h2>
            <div className="list">
              {calendars.map((calendar) => (
                <article className="list-item" key={calendar.id}>
                  <div className="brand" style={{ justifyContent: "space-between" }}>
                    <div>
                      <strong>{calendar.name}</strong>
                      <div className="meta">{calendar.description || "No description"}</div>
                    </div>
                    <span className="badge">{calendar.ownerId === session.user.id ? "owned" : "shared"}</span>
                  </div>
                  <p className="copy">
                    Owner: {calendar.owner.name || calendar.owner.email || "Unknown"} · {calendar.events.length} upcoming items
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="section">
            <h2>Upcoming events</h2>
            <div className="list">
              {upcomingEvents.map((event) => (
                <article className="list-item" key={event.id}>
                  <div className="brand" style={{ justifyContent: "space-between" }}>
                    <strong>{event.title}</strong>
                    <span className="badge">{event.calendar.name}</span>
                  </div>
                  <div className="meta">{formatDate(new Date(event.startsAt))}</div>
                  {event.location ? <div className="copy">{event.location}</div> : null}
                </article>
              ))}
              {!upcomingEvents.length ? <div className="muted">Nothing scheduled yet.</div> : null}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
