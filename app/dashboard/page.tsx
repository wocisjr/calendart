import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEvent, getOrCreateWorkspaceCalendar, removeCalendarMember } from "./actions";
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

type ViewMode = "week" | "month";

function parseDateInput(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseView(value?: string): ViewMode {
  return value === "month" ? "month" : "week";
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const offset = (day + 6) % 7;
  result.setDate(result.getDate() - offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfMonth(date: Date) {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfMonth(date: Date) {
  const result = startOfMonth(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
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

  return `${formatter.format(start)} - ${formatter.format(addDays(end, -1))}`;
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    month: "long",
    year: "numeric"
  }).format(date);
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

function formatMemberLabel(member: WorkspaceCalendar["members"][number]) {
  return member.user.username || member.user.name || member.user.email || "Neznámý";
}

function formatMemberRole(role: string) {
  if (role === "OWNER") return "Vlastník";
  if (role === "EDITOR") return "Editor";
  return "Pouze čtení";
}

function groupByDay(events: WorkspaceEvent[]) {
  return events.reduce<Record<string, WorkspaceEvent[]>>((acc, event) => {
    const key = toDayKey(new Date(event.startsAt));
    (acc[key] ??= []).push(event);
    return acc;
  }, {});
}

function makeViewHref(date: Date, view: ViewMode) {
  return `/dashboard?day=${toDayKey(date)}&view=${view}`;
}

async function loadWorkspace(sessionUserId: string) {
  const calendar = await getOrCreateWorkspaceCalendar(sessionUserId);
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

  return loadedCalendar as WorkspaceCalendar;
}

export default async function DashboardPage({
  searchParams
}: Readonly<{
  searchParams?: Promise<{ day?: string; view?: string }>;
}>) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const view = parseView(resolvedSearchParams.view);
  const calendarData = await loadWorkspace(session.user.id);

  const userMembership = calendarData.members.find((member) => member.userId === session.user.id);
  const isAllowed =
    session.user.role === "ADMIN" ||
    calendarData.ownerId === session.user.id ||
    Boolean(userMembership);
  const canManage = session.user.role === "ADMIN" || userMembership?.role === "OWNER" || userMembership?.role === "EDITOR";
  const canAdminister = session.user.role === "ADMIN" || userMembership?.role === "OWNER";

  if (!isAllowed) {
    return (
      <main className="shell">
        <section className="panel" style={{ maxWidth: 560, margin: "80px auto 0" }}>
          <div className="panel-title">Přístup omezen</div>
          <h1 className="panel-heading">Nemáš přístup do pracovního kalendáře.</h1>
          <p className="copy">Požádej administrátora, aby ti přístup vrátil.</p>
          <div className="nav-actions" style={{ marginTop: 16 }}>
            <Link className="button-ghost" href="/login">
              Zpět na přihlášení
            </Link>
            <LogoutButton />
          </div>
        </section>
      </main>
    );
  }

  const selectedDate = parseDateInput(resolvedSearchParams.day) ?? new Date();
  const rangeStart = view === "month" ? startOfMonth(selectedDate) : startOfWeek(selectedDate);
  const rangeEnd = view === "month" ? endOfMonth(selectedDate) : addDays(rangeStart, 7);
  const events = await prisma.event.findMany({
    where: {
      calendarId: calendarData.id,
      startsAt: {
        gte: rangeStart,
        lt: rangeEnd
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
  const selectedDayInput = toDateTimeLocal(selectedDate, "09:00");
  const selectedDayEndInput = toDateTimeLocal(selectedDate, "10:00");
  const memberCount = calendarData.members.length;
  const viewLabel = view === "month" ? formatMonthLabel(selectedDate) : formatWeekLabel(rangeStart, rangeEnd);
  const prevRangeDate = view === "month" ? addMonths(selectedDate, -1) : addDays(rangeStart, -7);
  const nextRangeDate = view === "month" ? addMonths(selectedDate, 1) : addDays(rangeStart, 7);
  const monthGridStart = startOfWeek(startOfMonth(selectedDate));
  const monthGridDays = Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(rangeStart, index));

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span>◫</span>
          </div>
          <div>
            <div>Pracovní kalendář</div>
            <div className="muted" style={{ fontSize: "0.88rem" }}>
              Sdílený kalendář pro celý tým
            </div>
          </div>
        </div>
        <div className="nav-actions">
          <span className="badge">{memberCount} členů</span>
          <LogoutButton />
        </div>
      </header>

      <section className="toolbar">
        <div>
          <div className="toolbar-title">{view === "month" ? "Měsíční pohled" : "Týdenní pohled"}</div>
          <div className="muted">{viewLabel}</div>
        </div>

        <div className="nav-actions">
          <Link className="button-ghost" href={makeViewHref(prevRangeDate, view)}>
            {view === "month" ? "Předchozí měsíc" : "Předchozí týden"}
          </Link>
          <Link className="button-ghost" href={makeViewHref(new Date(), view)}>
            Dnes
          </Link>
          <Link className="button-ghost" href={makeViewHref(nextRangeDate, view)}>
            {view === "month" ? "Další měsíc" : "Další týden"}
          </Link>
          <Link className={`button-ghost ${view === "week" ? "button-ghost--active" : ""}`} href={makeViewHref(selectedDate, "week")}>
            Týden
          </Link>
          <Link className={`button-ghost ${view === "month" ? "button-ghost--active" : ""}`} href={makeViewHref(selectedDate, "month")}>
            Měsíc
          </Link>
        </div>
      </section>

      <section className="calendar-layout">
        <aside className="sidebar">
          <section className="panel">
            <div className="panel-title">Vybraný den</div>
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
                      Přidal {event.createdBy.username || event.createdBy.name || event.createdBy.email || "Neznámý"} dne{" "}
                      {formatAddedAt(new Date(event.createdAt))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">&nbsp;</div>
            )}
          </section>

          <section className="panel">
            <div className="panel-title">Přidat událost</div>
            <form className="form-grid" action={createEvent}>
              <input type="hidden" name="calendarId" value={calendarData.id} />
              <div>
                <label className="label" htmlFor="event-title">
                  Název
                </label>
                <input id="event-title" name="title" className="field" placeholder="Porada" required />
              </div>
              <div className="inline-fields">
                <div>
                  <label className="label" htmlFor="startsAt">
                    Začátek
                  </label>
                  <input id="startsAt" name="startsAt" className="field" type="datetime-local" defaultValue={selectedDayInput} required />
                </div>
                <div>
                  <label className="label" htmlFor="endsAt">
                    Konec
                  </label>
                  <input id="endsAt" name="endsAt" className="field" type="datetime-local" defaultValue={selectedDayEndInput} required />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="event-location">
                  Místo
                </label>
                <input id="event-location" name="location" className="field" placeholder="Místnost A / Meet" />
              </div>
              <div>
                <label className="label" htmlFor="event-description">
                  Poznámky
                </label>
                <textarea id="event-description" name="description" className="textarea" placeholder="Volitelné poznámky" />
              </div>
              <button className="button-accent" type="submit" disabled={!canManage}>
                {canManage ? "Přidat událost" : "Jen pro čtení"}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-title">Členové</div>
            <div className="member-list">
              {calendarData.members.map((member) => {
                const isOwner = member.userId === calendarData.ownerId;
                const canRemove = canAdminister && !isOwner;

                return (
                  <article className="member-pill" key={member.id}>
                    <div>
                      <strong>{formatMemberLabel(member)}</strong>
                      <div className="muted">{member.user.email || "Bez e-mailu"}</div>
                    </div>
                    <div className="member-actions">
                      <span className="badge">{formatMemberRole(member.role)}</span>
                      {canRemove ? (
                        <form action={removeCalendarMember}>
                          <input type="hidden" name="memberId" value={member.id} />
                          <button className="button-danger button-danger--small" type="submit">
                            Odebrat
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </aside>

        <div className="calendar-board">
          {view === "month" ? (
            <div className="month-grid">
              {monthGridDays.map((day) => {
                const dayKey = toDayKey(day);
                const dayEvents = eventsByDay[dayKey] ?? [];
                const isSelected = dayKey === selectedDayKey;
                const isOutsideMonth = day.getMonth() !== selectedDate.getMonth();
                const visibleEvents = dayEvents.slice(0, 3);
                const hiddenCount = Math.max(0, dayEvents.length - visibleEvents.length);

                return (
                  <Link
                    key={dayKey}
                    href={makeViewHref(day, "month")}
                    className={`day-card day-card--month ${isSelected ? "day-card--selected" : ""} ${isOutsideMonth ? "day-card--outside" : ""}`}
                  >
                    <div className="day-head">
                      <div>
                        <div className="day-label">{formatDayTitle(day)}</div>
                      </div>
                      <span className="day-number">{day.getDate()}</span>
                    </div>

                    <div className="day-events day-events--month">
                      {visibleEvents.map((event) => (
                        <article className="event-chip" key={event.id}>
                          <div className="event-chip__time">{formatTime(new Date(event.startsAt))}</div>
                          <div className="event-chip__title">{event.title}</div>
                          <div className="event-chip__meta">
                            {event.createdBy.username || event.createdBy.name || event.createdBy.email || "Neznámý"}
                          </div>
                        </article>
                      ))}
                      {hiddenCount > 0 ? <div className="event-chip event-chip--more">+{hiddenCount} další</div> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="week-grid">
              {weekDays.map((day) => {
                const dayKey = toDayKey(day);
                const dayEvents = eventsByDay[dayKey] ?? [];
                const isSelected = dayKey === selectedDayKey;
                const visibleEvents = dayEvents.slice(0, 3);
                const hiddenCount = Math.max(0, dayEvents.length - visibleEvents.length);

                return (
                  <Link
                    key={dayKey}
                    href={makeViewHref(day, "week")}
                    className={`day-card ${isSelected ? "day-card--selected" : ""}`}
                  >
                    <div className="day-head">
                      <div>
                        <div className="day-label">{formatDayTitle(day)}</div>
                        <div className="muted">{dayEvents.length} událostí</div>
                      </div>
                      <span className="day-number">{day.getDate()}</span>
                    </div>

                    <div className="day-events">
                      {visibleEvents.map((event) => (
                        <article className="event-chip" key={event.id}>
                          <div className="event-chip__time">{formatTime(new Date(event.startsAt))}</div>
                          <div className="event-chip__title">{event.title}</div>
                          <div className="event-chip__meta">
                            {event.createdBy.username || event.createdBy.name || event.createdBy.email || "Neznámý"}
                          </div>
                        </article>
                      ))}
                      {hiddenCount > 0 ? <div className="event-chip event-chip--more">+{hiddenCount} další</div> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
