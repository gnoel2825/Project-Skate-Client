import React, { Component } from "react";
import api from "../api";
import { useSearchParams, Link } from "react-router-dom";

import Card from "react-bootstrap/Card";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Dropdown from "react-bootstrap/Dropdown";
import { CIcon } from "@coreui/icons-react";
import { cilNotes } from "@coreui/icons";

import NowCard from "./NowCard";
import MyStudentsCard from "./MyStudentsCard";

/* =======================
   Date + formatting helpers
======================= */
function ymd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const isHHMM = (v) => typeof v === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(v);

function formatHeaderDate(dateObj) {
  if (!dateObj) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateObj);
}

const formatTime = (value) => {
  if (!value) return "";

  if (isHHMM(value)) {
    const [hh, mm, ss] = value.split(":").map((n) => Number(n));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "";
    const dt = new Date(2000, 0, 1, hh, mm || 0, ss || 0, 0);
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(dt);
  }

  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(dt);
};

const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeLabelShort(start, end) {
  const s = compactTime(start);
  const e = compactTime(end);

  if (!s && !e) return { top: "—", bottom: "" };
  if (s && !e) return { top: s, bottom: "" };
  if (!s && e) return { top: e, bottom: "" };

  return { top: s, bottom: `–${e}` };
}

function compactTime(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [hh, mm] = value.split(":").map(Number);
    const dt = new Date(2000, 0, 1, hh, mm || 0, 0);
    return dt
      .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      .replace(":00", "")
      .replace(" AM", "a")
      .replace(" PM", "p")
      .replace(" am", "a")
      .replace(" pm", "p");
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .replace(":00", "")
    .replace(" AM", "a")
    .replace(" PM", "p")
    .replace(" am", "a")
    .replace(" pm", "p");
}

function compactRange(start, end) {
  const s = compactTime(start);
  const e = compactTime(end);
  if (!s && !e) return "";
  if (s && !e) return s;
  if (!s && e) return e;
  return `${s}-${e}`;
}

function coerceArray(resData) {
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData?.rosters)) return resData.rosters;
  if (Array.isArray(resData?.data)) return resData.data;
  if (Array.isArray(resData?.items)) return resData.items;
  return [];
}

const SectionKicker = ({ children, className = "", style = {} }) => (
  <div
    className={`text-uppercase text-muted ${className}`}
    style={{ fontSize: 11, letterSpacing: 0.6, ...style }}
  >
    {children}
  </div>
);

const formatTimeRange = (start, end) => {
  const s = formatTime(start);
  const e = formatTime(end);
  if (!s && !e) return "";
  if (s && !e) return s;
  if (!s && e) return e;
  return `${s} – ${e}`;
};

function normalizeOccurrenceRosterId(occ) {
  return (
    occ?.roster?.id ??
    occ?.roster_id ??
    occ?.lesson_plan?.roster?.id ??
    occ?.lesson_plan?.roster_id ??
    null
  );
}

function weekdayNumberFromYmd(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getDay();
}

function timeKey(value) {
  if (!value) return null;

  if (isHHMM(value)) {
    const [hh, mm] = value.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return hh * 60 + mm;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  if (aStart == null || bStart == null) return false;

  const aE = aEnd == null ? aStart + 1 : aEnd;
  const bE = bEnd == null ? bStart + 1 : bEnd;

  return aStart < bE && aE > bStart;
}

const API_BASE = process.env.REACT_APP_API_BASE_URL;

/* =======================
   Query wrapper
======================= */
function CalendarPageWithQuery(props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get("date");

  const setDateParam = (yyyyMmDd) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (yyyyMmDd) next.set("date", yyyyMmDd);
        else next.delete("date");
        return next;
      },
      { replace: false }
    );
  };

  return <CalendarPage {...props} dateParam={dateParam} setDateParam={setDateParam} />;
}

export default CalendarPageWithQuery;

/* =======================
   Page
======================= */
class CalendarPage extends Component {
  calendarCardRef = React.createRef();

  state = {
    monthAnchor: new Date(),
    selectedDate: new Date(),

    occurrences: [],
    loading: false,
    error: null,

    rosters: [],
    rostersLoading: false,
    rostersError: null,

    oneOffMeetings: [],
    oneOffLoading: false,
    oneOffError: null,

    showAllWeekly: false,
    showAllOneOff: false,
    showAllLessonPlans: false,

    rightMaxHeight: null,
    showAllSchedule: false,

    weeklyOverview: {},
    weeklyOverviewLoading: false,
    weeklyOverviewError: null,
  };

  componentDidMount() {
    const { dateParam } = this.props;

    if (dateParam) {
      const [y, m, d] = dateParam.split("-").map(Number);
      const selected = new Date(y, m - 1, d);
      this.setState({ selectedDate: selected, monthAnchor: selected }, () => this.fetchForDate(selected));
    } else {
      this.fetchForDate(this.state.selectedDate);
    }

    this.syncRightHeight();
    this.loadWeeklyOverview();
    window.addEventListener("resize", this.syncRightHeight);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.dateParam !== this.props.dateParam) {
      const { dateParam } = this.props;

      if (dateParam) {
        const [y, m, d] = dateParam.split("-").map(Number);
        const selected = new Date(y, m - 1, d);
        this.setState({ selectedDate: selected, monthAnchor: selected }, () => this.fetchForDate(selected));
      } else {
        const today = new Date();
        this.setState({ selectedDate: today, monthAnchor: today }, () => this.fetchForDate(today));
      }
    }

    if (
      prevState.rostersLoading !== this.state.rostersLoading ||
      prevState.oneOffMeetings !== this.state.oneOffMeetings ||
      prevState.showAllWeekly !== this.state.showAllWeekly ||
      prevState.showAllOneOff !== this.state.showAllOneOff ||
      prevState.showAllLessonPlans !== this.state.showAllLessonPlans ||
      prevState.showAllSchedule !== this.state.showAllSchedule
    ) {
      this.syncRightHeight();
    }
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.syncRightHeight);
  }

  isMobile = () => window.matchMedia && window.matchMedia("(max-width: 576px)").matches;

  syncRightHeight = () => {
    if (window.matchMedia && window.matchMedia("(max-width: 768px)").matches) {
      if (this.state.rightMaxHeight !== null) this.setState({ rightMaxHeight: null });
      return;
    }

    const cal = this.calendarCardRef.current;
    if (!cal) return;

    const h = Math.round(cal.getBoundingClientRect().height);
    const max = Math.max(220, h);

    if (this.state.rightMaxHeight !== max) this.setState({ rightMaxHeight: max });
  };

  loadWeeklyOverview = async () => {
    this.setState({ weeklyOverviewLoading: true, weeklyOverviewError: null });

    try {
      let rostersRes = null;
      try {
        rostersRes = await api.get(`/rosters`);
      } catch (e1) {
        rostersRes = await api.get(`/rosters/all`);
      }

      const rosters = coerceArray(rostersRes.data);

      const scheduleRequests = (rosters || [])
        .filter((r) => r?.id != null)
        .map((r) =>
          api
            .get(`/rosters/${r.id}/roster_schedules`)
            .then((res) => ({ roster: r, schedules: coerceArray(res.data) }))
            .catch(() => ({ roster: r, schedules: [] }))
        );

      const results = await Promise.all(scheduleRequests);

      const grouped = {};
      results.forEach(({ roster, schedules }) => {
        (schedules || []).forEach((sch) => {
          const wd = Number(sch.weekday);
          if (Number.isNaN(wd)) return;
          grouped[wd] = grouped[wd] || [];
          grouped[wd].push({ roster, schedule: sch });
        });
      });

      Object.keys(grouped).forEach((k) => {
        grouped[k] = grouped[k]
          .slice()
          .sort((a, b) => {
            const at = String(a.schedule?.starts_at || "");
            const bt = String(b.schedule?.starts_at || "");
            if (at !== bt) return at.localeCompare(bt);
            const an = String(a.roster?.name || "").toLowerCase();
            const bn = String(b.roster?.name || "").toLowerCase();
            return an.localeCompare(bn);
          });
      });

      this.setState({ weeklyOverview: grouped, weeklyOverviewLoading: false });
    } catch (err) {
      const msg =
        err.response?.data?.errors?.join(", ") ||
        err.response?.data?.error ||
        err.message ||
        "Failed to load weekly overview";
      this.setState({ weeklyOverviewError: msg, weeklyOverviewLoading: false });
    }
  };

  fetchForDate = (dateObj) => {
    const dateStr = ymd(dateObj);

    this.setState({
      loading: true,
      error: null,
      rostersLoading: true,
      rostersError: null,
      oneOffLoading: true,
      oneOffError: null,
    });

    api
      .get(`/lesson_plans_by_date`, {
        params: { date: dateStr },
      })
      .then((res) => this.setState({ occurrences: res.data || [], loading: false }))
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to load lesson plans for date";
        this.setState({ error: msg, loading: false, occurrences: [] });
      });

    api
      .get(`/rosters_by_date`, {
        params: { date: dateStr },
      })
      .then((res) => this.setState({ rosters: res.data || [], rostersLoading: false }))
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to load rosters for date";
        this.setState({ rostersError: msg, rostersLoading: false, rosters: [] });
      });

    api
      .get(`/roster_meetings_by_date`, {
        params: { date: dateStr },
      })
      .then((res) => this.setState({ oneOffMeetings: res.data || [], oneOffLoading: false }))
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to load one-off meetings";
        this.setState({ oneOffError: msg, oneOffLoading: false, oneOffMeetings: [] });
      });
  };

  changeMonth = (delta) => {
    const d = new Date(this.state.monthAnchor);
    d.setMonth(d.getMonth() + delta);
    this.setState({ monthAnchor: d });
  };

  selectDate = (dateObj) => {
    this.setState({ selectedDate: dateObj, monthAnchor: dateObj });
    this.fetchForDate(dateObj);

    this.props.setDateParam?.(ymd(dateObj));
    this.setState({
      showAllLessonPlans: false,
      showAllWeekly: false,
      showAllOneOff: false,
      showAllSchedule: false,
    });
  };

  buildCalendarCells() {
    const anchor = this.state.monthAnchor;
    const year = anchor.getFullYear();
    const month = anchor.getMonth();

    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const start = new Date(year, month, 1 - startDay);

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }

  findRosterById = (rosterId) => {
    if (rosterId == null) return null;
    return (this.state.rosters || []).find((r) => String(r.id) === String(rosterId)) || null;
  };

  buildCreateLessonPlanLink = (session) => {
    const params = new URLSearchParams();
    const date = session?.taught_on || ymd(this.state.selectedDate);

    params.set("date", date);
    if (session?.rosterId) params.set("roster_id", String(session.rosterId));
    if (session?.meeting?.id) params.set("meeting_id", String(session.meeting.id));
    if (session?.starts_at) params.set("starts_at", String(session.starts_at));
    if (session?.ends_at) params.set("ends_at", String(session.ends_at));
    if (session?.location) params.set("location", String(session.location));

    return `/lesson-plans/new?${params.toString()}`;
  };

  renderWeeklyScheduleCard() {
    const { weeklyOverview, weeklyOverviewLoading, weeklyOverviewError } = this.state;

    return (
      <Card className="mb-3" style={{ borderRadius: 14 }}>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div>
              <Card.Title className="mb-0">
                <SectionKicker>My Weekly Schedule</SectionKicker>
              </Card.Title>
            </div>
            <Badge bg="light" text="dark">
              {Object.values(weeklyOverview || {}).reduce((sum, arr) => sum + (arr?.length || 0), 0)}
            </Badge>
          </div>

          {weeklyOverviewError ? (
            <Alert variant="danger" className="mt-3 mb-0">
              {weeklyOverviewError}
            </Alert>
          ) : null}

          {weeklyOverviewLoading ? (
            <div className="text-muted mt-3" style={{ fontSize: 13 }}>
              Loading weekly schedule…
            </div>
          ) : (
            <div className="mt-3">
              {(() => {
                const renderDayCol = (wd) => {
                  const rows = (this.state.weeklyOverview || {})[wd] || [];

                  return (
                    <Col key={wd} xs={12} sm={6} md={3} lg>
                      <div className="border rounded-3 p-2 h-100" style={{ background: "#fff" }}>
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="text-uppercase text-muted" style={{ fontSize: 10, letterSpacing: 0.6 }}>
                            {dayShort[wd]}
                          </div>
                          <span className="text-muted" style={{ fontSize: 12 }}>
                            {rows.length ? rows.length : ""}
                          </span>
                        </div>

                        {rows.length === 0 ? (
                          <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                            —
                          </div>
                        ) : (
                          <div className="mt-2 d-flex flex-column" style={{ gap: 6 }}>
                            {rows.slice(0, 6).map(({ roster, schedule }) => {
                              const t = compactRange(schedule?.starts_at, schedule?.ends_at);

                              return (
                                <Link
                                  key={`${roster?.id}-${schedule?.id}`}
                                  to={roster?.id != null ? `/rosters/${roster.id}` : "#"}
                                  onClick={(e) => {
                                    if (roster?.id == null) e.preventDefault();
                                  }}
                                  className="text-decoration-none"
                                  style={{ color: "inherit" }}
                                >
                                  <div
                                    className="rounded-3 px-2 py-1"
                                    style={{ cursor: roster?.id != null ? "pointer" : "default" }}
                                    onMouseEnter={(e) => {
                                      if (roster?.id != null) e.currentTarget.style.background = "#f8f9fa";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "transparent";
                                    }}
                                  >
                                    <div
                                      className="fw-semibold"
                                      style={{
                                        fontSize: 12,
                                        lineHeight: 1.15,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                      title={roster?.name || ""}
                                    >
                                      {roster?.name || "Roster"}
                                    </div>

                                    <div className="text-muted" style={{ fontSize: 11, lineHeight: 1.15 }}>
                                      {t || "time"}
                                      {schedule?.location ? ` • ${schedule.location}` : ""}
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}

                            {rows.length > 6 ? (
                              <div className="text-muted" style={{ fontSize: 11 }}>
                                +{rows.length - 6} more
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </Col>
                  );
                };

                return (
                  <>
                    <div className="d-none d-lg-block">
                      <Row className="g-2">{[0, 1, 2, 3, 4].map(renderDayCol)}</Row>
                      <Row className="g-2 mt-2">{[5, 6].map(renderDayCol)}</Row>
                    </div>

                    <div className="d-lg-none">
                      <Row className="g-2">{Array.from({ length: 7 }).map((_, wd) => renderDayCol(wd))}</Row>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </Card.Body>
      </Card>
    );
  }

  renderCalendarMini() {
    const { monthAnchor, selectedDate } = this.state;

    const monthLabel = monthAnchor.toLocaleString(undefined, { month: "long", year: "numeric" });
    const cells = this.buildCalendarCells();
    const selectedKey = ymd(selectedDate);

    const mobile = this.isMobile();

    const calGap = mobile ? 4 : 6;
    const cellHeight = mobile ? 34 : 32;
    const dayFont = 10;

    return (
      <Card ref={this.calendarCardRef} className="mb-3" style={{ borderRadius: 14 }}>
        <Card.Body style={{ padding: mobile ? 12 : 14 }}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span style={{ fontSize: 15, fontWeight: 700 }}>{monthLabel}</span>
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => this.selectDate(new Date())}
                style={{ borderRadius: 999, padding: "4px 10px" }}
              >
                Today
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => this.changeMonth(-1)}
                style={{ borderRadius: 999, width: 34, padding: 0 }}
              >
                ←
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => this.changeMonth(1)}
                style={{ borderRadius: 999, width: 34, padding: 0 }}
              >
                →
              </Button>
            </div>
          </div>

          <div className="d-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: calGap }}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div
                key={d}
                className="text-muted fw-semibold"
                style={{ fontSize: dayFont, textAlign: "center" }}
              >
                {mobile ? d[0] : d}
              </div>
            ))}

            {cells.map((d) => {
              const inMonth = d.getMonth() === monthAnchor.getMonth();
              const key = ymd(d);
              const isSelected = key === selectedKey;

              return (
                <Button
                  key={key}
                  variant={isSelected ? "primary" : "outline-secondary"}
                  onClick={() => this.selectDate(d)}
                  className="p-0"
                  style={{
                    height: cellHeight,
                    borderRadius: 10,
                    opacity: inMonth ? 1 : 0.42,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    lineHeight: "13px",
                  }}
                >
                  {d.getDate()}
                </Button>
              );
            })}
          </div>
        </Card.Body>
      </Card>
    );
  }

  renderDayAgendaCard() {
    const {
      selectedDate,
      occurrences,
      oneOffMeetings,
      rosters,
      loading,
      error,
      rostersError,
      rostersLoading,
      oneOffError,
      oneOffLoading,
    } = this.state;

    const selectedDateStr = ymd(selectedDate);
    const selectedDow = selectedDate.getDay();

    const sessionKey = ({ rosterId, taught_on, starts_at, ends_at, location, source = "session" }) =>
      `${source}|${rosterId ?? "no-roster"}|${taught_on || ""}|${starts_at || ""}|${ends_at || ""}|${location || ""}`;

    const sessionsMap = new Map();

    // 1) Weekly roster schedule slots for this weekday
    (rosters || []).forEach((roster) => {
      const schedules = Array.isArray(roster?.roster_schedules) ? roster.roster_schedules : [];

      schedules
        .filter((sch) => Number(sch?.weekday) === selectedDow)
        .forEach((sch) => {
          const key = sessionKey({
            source: "weekly",
            rosterId: roster?.id ?? null,
            taught_on: selectedDateStr,
            starts_at: sch?.starts_at || "",
            ends_at: sch?.ends_at || "",
            location: sch?.location || "",
          });

          if (!sessionsMap.has(key)) {
            sessionsMap.set(key, {
              key,
              source: "weekly",
              rosterId: roster?.id ?? null,
              roster,
              taught_on: selectedDateStr,
              starts_at: sch?.starts_at || null,
              ends_at: sch?.ends_at || null,
              location: sch?.location || null,
              notes: null,
              meeting: null,
              lessonPlans: [],
              weeklySchedule: sch,
            });
          }
        });
    });

    // 2) One-off meetings for this date
    (oneOffMeetings || []).forEach((meeting) => {
      const rosterId =
        meeting?.roster?.id ??
        meeting?.roster_id ??
        null;

      const meetingDate = meeting?.taught_on || selectedDateStr;
      const meetingStart = timeKey(meeting?.starts_at);
      const meetingEnd = timeKey(meeting?.ends_at);

      let matchedExistingKey = null;

      for (const [key, session] of sessionsMap.entries()) {
        const sameDate = String(session.taught_on || "") === String(meetingDate || "");
        if (!sameDate) continue;

        const sessionRosterId = session.rosterId != null ? String(session.rosterId) : null;
        const meetingRosterId = rosterId != null ? String(rosterId) : null;
        if (sessionRosterId && meetingRosterId && sessionRosterId !== meetingRosterId) continue;

        const sS = timeKey(session.starts_at);
        const sE = timeKey(session.ends_at);

        if (meetingStart != null && sS != null && overlaps(meetingStart, meetingEnd, sS, sE)) {
          matchedExistingKey = key;
          break;
        }
      }

      if (matchedExistingKey) {
        const existing = sessionsMap.get(matchedExistingKey);
        existing.source = "meeting";
        existing.meeting = meeting;
        existing.notes = meeting?.notes || existing.notes || null;
        existing.location = existing.location || meeting?.location || null;
        if (!existing.rosterId && rosterId != null) existing.rosterId = rosterId;
        if (!existing.roster && meeting?.roster) existing.roster = meeting.roster;
        return;
      }

      const key = sessionKey({
        source: "meeting",
        rosterId,
        taught_on: meetingDate,
        starts_at: meeting?.starts_at || "",
        ends_at: meeting?.ends_at || "",
        location: meeting?.location || "",
      });

      if (!sessionsMap.has(key)) {
        sessionsMap.set(key, {
          key,
          source: "meeting",
          rosterId,
          roster: meeting?.roster || this.findRosterById(rosterId) || null,
          taught_on: meetingDate,
          starts_at: meeting?.starts_at || null,
          ends_at: meeting?.ends_at || null,
          location: meeting?.location || null,
          notes: meeting?.notes || null,
          meeting,
          lessonPlans: [],
          weeklySchedule: null,
        });
      }
    });

    // 3) Lesson plan occurrences for this date
    (occurrences || []).forEach((occ) => {
      const occRosterId = normalizeOccurrenceRosterId(occ);
      const occS = timeKey(occ?.starts_at);
      const occE = timeKey(occ?.ends_at);
      const occDate = occ?.taught_on || selectedDateStr;

      let matchedExistingKey = null;

      for (const [key, session] of sessionsMap.entries()) {
        const sameDate = String(session.taught_on || "") === String(occDate || "");
        if (!sameDate) continue;

        const sessionRosterId = session.rosterId != null ? String(session.rosterId) : null;
        const occRosterIdStr = occRosterId != null ? String(occRosterId) : null;

        if (sessionRosterId && occRosterIdStr && sessionRosterId !== occRosterIdStr) continue;

        const sS = timeKey(session.starts_at);
        const sE = timeKey(session.ends_at);

        if (occS != null && sS != null && overlaps(occS, occE, sS, sE)) {
          matchedExistingKey = key;
          break;
        }

        if (
          matchedExistingKey == null &&
          occRosterIdStr &&
          sessionRosterId &&
          occRosterIdStr === sessionRosterId &&
          String(session.starts_at || "") === String(occ?.starts_at || "") &&
          String(session.ends_at || "") === String(occ?.ends_at || "")
        ) {
          matchedExistingKey = key;
        }
      }

      if (matchedExistingKey) {
        const existing = sessionsMap.get(matchedExistingKey);
        existing.lessonPlans.push(occ);
        if (!existing.roster && (occ?.roster || occ?.lesson_plan?.roster)) {
          existing.roster = occ?.roster || occ?.lesson_plan?.roster;
        }
        if (!existing.rosterId && occRosterId != null) existing.rosterId = occRosterId;
        if (!existing.location && occ?.location) existing.location = occ.location;
        return;
      }

      const key = sessionKey({
        source: "occurrence",
        rosterId: occRosterId,
        taught_on: occDate,
        starts_at: occ?.starts_at || "",
        ends_at: occ?.ends_at || "",
        location: occ?.location || "",
      });

      if (!sessionsMap.has(key)) {
        sessionsMap.set(key, {
          key,
          source: "occurrence",
          rosterId: occRosterId,
          roster: occ?.roster || occ?.lesson_plan?.roster || this.findRosterById(occRosterId) || null,
          taught_on: occDate,
          starts_at: occ?.starts_at || null,
          ends_at: occ?.ends_at || null,
          location: occ?.location || null,
          notes: null,
          meeting: null,
          lessonPlans: [],
          weeklySchedule: null,
        });
      }

      sessionsMap.get(key).lessonPlans.push(occ);
    });

    const sessionsAll = Array.from(sessionsMap.values()).sort((a, b) => {
      const aStart = timeKey(a.starts_at) ?? 99999;
      const bStart = timeKey(b.starts_at) ?? 99999;
      if (aStart !== bStart) return aStart - bStart;

      const aRoster = String(a.roster?.name || "");
      const bRoster = String(b.roster?.name || "");
      return aRoster.localeCompare(bRoster);
    });

    const totalSessions = sessionsAll.length;
    const sessionLimit = 6;
    const visibleSessions = this.state.showAllSchedule
      ? sessionsAll
      : sessionsAll.slice(0, sessionLimit);
    const hiddenSessionCount = Math.max(0, sessionsAll.length - visibleSessions.length);

    return (
      <Card className="mt-3">
        <Card.Body>
          <Card.Title className="d-flex justify-content-between align-items-center mb-0">
            <SectionKicker>{formatHeaderDate(selectedDate)}</SectionKicker>

            <div className="d-flex align-items-center gap-2">
              <Badge
                bg="light"
                text="dark"
                pill
                className="px-2 py-1"
                style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}
              >
                {totalSessions}
              </Badge>
            </div>
          </Card.Title>

          {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
          {rostersError && <Alert variant="danger" className="mt-3">{rostersError}</Alert>}
          {oneOffError && <Alert variant="danger" className="mt-3">{oneOffError}</Alert>}
          {(loading || rostersLoading || oneOffLoading) && <p className="mt-3 text-muted">Loading…</p>}

          {!loading && !rostersLoading && !oneOffLoading && !error && !rostersError && !oneOffError && sessionsAll.length === 0 ? (
            <div className="text-muted mt-3">No classes scheduled for this date.</div>
          ) : null}

          {!loading && !rostersLoading && !oneOffLoading && !error && !rostersError && !oneOffError && sessionsAll.length > 0 ? (
            <div className="d-grid mt-3" style={{ gap: 12 }}>
              {visibleSessions.map((session, idx) => {
                const fallbackRoster = session.roster || this.findRosterById(session.rosterId);
                const rosterName = fallbackRoster?.name || "No Roster";
                const mobileTime = formatTimeRange(session.starts_at, session.ends_at) || "Time TBD";
                const tl = timeLabelShort(session.starts_at, session.ends_at);
                const hasLessonPlans = (session.lessonPlans || []).length > 0;

                return (
                  <div
                    key={session.key || idx}
                    className="d-flex flex-column"
                    style={{ gap: 8 }}
                  >
                    <div className="d-md-none">
                      <div className="d-flex align-items-center" style={{ gap: 10 }}>
                        <div
                          className="text-muted"
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: 0.2,
                            minWidth: 64,
                            textAlign: "left",
                          }}
                        >
                          {mobileTime}
                        </div>

                        <div
                          aria-hidden="true"
                          style={{
                            height: 1,
                            flex: 1,
                            background: "#e9ecef",
                          }}
                        />
                      </div>
                    </div>

                    <div className="d-flex align-items-stretch" style={{ gap: 12 }}>
                      <div
                        className="d-none d-md-flex flex-column align-items-end position-relative"
                        style={{
                          width: 74,
                          flex: "0 0 74px",
                          paddingRight: 10,
                        }}
                      >
                        <div
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            top: 6,
                            bottom: 6,
                            right: 4,
                            width: 1,
                            background: "#e9ecef",
                          }}
                        />
                        <div
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            top: 14,
                            right: 0,
                            width: 9,
                            height: 9,
                            borderRadius: 999,
                            background: "#ced4da",
                          }}
                        />

                        <div style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.05 }}>
                          {tl.top}
                        </div>
                        {tl.bottom ? (
                          <div className="text-muted" style={{ fontSize: 11, lineHeight: 1.05, marginTop: 2 }}>
                            {tl.bottom}
                          </div>
                        ) : (
                          <div style={{ height: 13 }} />
                        )}
                      </div>

                      <div
                        className="border rounded-3 flex-grow-1"
                        style={{
                          padding: 14,
                          background: "rgba(255,255,255,0.92)",
                          boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div style={{ minWidth: 0 }}>
                            {session.rosterId ? (
                              <Link
                                to={`/rosters/${session.rosterId}`}
                                className="text-decoration-none"
                                style={{ color: "inherit" }}
                              >
                                <div
                                  style={{
                                    fontWeight: 700,
                                    wordBreak: "break-word",
                                    lineHeight: 1.15,
                                    cursor: "pointer",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                >
                                  {rosterName}
                                </div>
                              </Link>
                            ) : (
                              <div style={{ fontWeight: 700, wordBreak: "break-word", lineHeight: 1.15 }}>
                                {rosterName}
                              </div>
                            )}

                            <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
                              {session.source === "meeting" ? (
                                <Badge bg="warning" text="dark" style={{ fontWeight: 600 }}>
                                  one-off
                                </Badge>
                              ) : null}

                              {session.weeklySchedule ? (
                                <Badge bg="light" text="dark" style={{ fontWeight: 600 }}>
                                  weekly
                                </Badge>
                              ) : null}

                              {session.location ? (
                                <Badge bg="light" text="dark" style={{ fontWeight: 600 }}>
                                  {session.location}
                                </Badge>
                              ) : null}
                            </div>

                            {session.notes ? (
                              <div className="text-muted mt-2" style={{ fontSize: 12, lineHeight: 1.25 }}>
                                {session.notes}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: "1px solid rgba(0,0,0,0.06)",
                          }}
                        >
                          <div className="text-muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                            Lesson Plan(s)
                          </div>

                          {!hasLessonPlans ? (
                            <div
                              className="border rounded-3 p-3"
                              style={{
                                background: "#fbfbfd",
                                borderColor: "#e9ecef",
                              }}
                            >
                              <div className="text-muted" style={{ fontSize: 12 }}>
                                No lesson plans scheduled for this class yet.
                              </div>

                              <div className="mt-2">
                                <Button
                                  as={Link}
                                  to={this.buildCreateLessonPlanLink(session)}
                                  size="sm"
                                  variant="outline-primary"
                                  className="rounded-pill px-3"
                                  style={{ fontSize: 12 }}
                                >
                                  Schedule Lesson Plan
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="d-flex flex-wrap gap-2">
                              {session.lessonPlans.map((occ) => (
                                <Link
                                  key={`lp-${occ.id}`}
                                  to={`/lesson-plans/${occ.lesson_plan?.id}`}
                                  className="btn btn-outline-primary btn-sm"
                                  style={{
                                    padding: "6px 10px",
                                    fontSize: 12,
                                    borderRadius: 999,
                                    maxWidth: "100%",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={occ.lesson_plan?.title || "Lesson plan"}
                                >
                                  {occ.lesson_plan?.title || "Lesson plan"}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {hiddenSessionCount > 0 && (
            <div className="d-flex justify-content-center mt-3">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => this.setState({ showAllSchedule: true })}
              >
                Show {hiddenSessionCount} more sessions
              </Button>
            </div>
          )}

          {this.state.showAllSchedule && sessionsAll.length > sessionLimit && (
            <div className="d-flex justify-content-center mt-2">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => this.setState({ showAllSchedule: false })}
              >
                Show fewer sessions
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>
    );
  }

  renderHeaderNewMenu(selectedDate) {
    return (
      <Dropdown align="end">
        <Dropdown.Toggle
          variant="primary"
          id="dashboard-new-dropdown"
          className="border-0 shadow-sm"
          style={{
            borderRadius: 999,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.2,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: 13,
              lineHeight: 1,
              opacity: 0.9,
            }}
          >
            ＋
          </span>
          <span>New</span>
        </Dropdown.Toggle>

        <Dropdown.Menu
          style={{
            borderRadius: 14,
            padding: 8,
            minWidth: 220,
            border: "1px solid #e9ecef",
            boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
          }}
        >
          <Dropdown.Item
            as={Link}
            to="/students/new"
            className="rounded-3"
            style={{
              padding: "9px 10px",
              fontSize: 11,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "#6c757d",
            }}
          >
            New Student
          </Dropdown.Item>

          <Dropdown.Item
            as={Link}
            to="/rosters/new"
            className="rounded-3"
            style={{
              padding: "9px 10px",
              fontSize: 11,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "#6c757d",
            }}
          >
            New Roster
          </Dropdown.Item>

          <Dropdown.Item
            as={Link}
            to={`/lesson-plans/new?date=${ymd(selectedDate)}`}
            className="rounded-3"
            style={{
              padding: "9px 10px",
              fontSize: 11,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "#6c757d",
            }}
          >
            New Lesson Plan
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  render() {
    const { selectedDate } = this.state;

    return (
      <div className="container mt-4" style={{ maxWidth: 1100 }}>
        <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
          <div>
            <h1 className="mb-1">Dashboard</h1>
            <div className="text-muted" style={{ fontSize: 14 }}>
              Welcome back{this.props.currentUser?.first_name ? `, ${this.props.currentUser.first_name}` : ""}.
            </div>
          </div>

          <div className="d-flex align-items-center">
            {this.renderHeaderNewMenu(selectedDate)}
          </div>
        </div>

        <Row>
          <Col md={5} className="mb-3">
            {this.renderCalendarMini()}

            <div
              style={{
                maxHeight: this.state.rightMaxHeight ?? "none",
                paddingRight: this.state.rightMaxHeight ? 6 : 0,
              }}
            >
              {this.renderDayAgendaCard()}
            </div>
          </Col>

          <Col md={7} className="mb-3">
            {this.renderWeeklyScheduleCard()}
            <MyStudentsCard />
          </Col>
        </Row>
      </div>
    );
  }
}
