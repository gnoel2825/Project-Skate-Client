import React, { Component } from "react";
import api from "../api";
import { useSearchParams, Link } from "react-router-dom";

import Card from "react-bootstrap/Card";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import { CIcon } from '@coreui/icons-react';
import { cilNotes } from '@coreui/icons';

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
  // "Jan 17 2026"
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

// safe “array extraction” helper
function coerceArray(resData) {
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData?.rosters)) return resData.rosters;
  if (Array.isArray(resData?.data)) return resData.data;
  if (Array.isArray(resData?.items)) return resData.items;
  return [];
}

// same SectionKicker style you already love
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

const everyWeekdayLabel = (weekdayNum) => {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const name = names[Number(weekdayNum)];
  if (!name) return "every week";
  return `${name} •`;
};

const API_BASE = process.env.REACT_APP_API_BASE_URL;


/* =======================
   Query wrapper
======================= */
function CalendarPageWithQuery(props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get("date"); // "YYYY-MM-DD" or null

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

    weeklyOverview: {}, // { [weekdayNumber]: [{ roster, schedule }] }
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
    // 1) get rosters list
    let rostersRes = null;
    try {
      rostersRes = await api.get(`${API_BASE}/rosters`, { withCredentials: true });
    } catch (e1) {
      rostersRes = await api.get(`${API_BASE}/rosters/all`, { withCredentials: true });
    }

    const rosters = coerceArray(rostersRes.data);

    // 2) fetch weekly schedules for each roster
    const scheduleRequests = (rosters || [])
      .filter((r) => r?.id != null)
      .map((r) =>
        api
          .get(`${API_BASE}/rosters/${r.id}/roster_schedules`, { withCredentials: true })
          .then((res) => ({ roster: r, schedules: coerceArray(res.data) }))
          .catch(() => ({ roster: r, schedules: [] }))
      );

    const results = await Promise.all(scheduleRequests);

    // 3) group by weekday
    const grouped = {};
    results.forEach(({ roster, schedules }) => {
      (schedules || []).forEach((sch) => {
        const wd = Number(sch.weekday);
        if (Number.isNaN(wd)) return;
        grouped[wd] = grouped[wd] || [];
        grouped[wd].push({ roster, schedule: sch });
      });
    });

    // 4) sort inside day
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
      .get(`${API_BASE}/lesson_plans_by_date`, {
        withCredentials: true,
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
      .get(`${API_BASE}/rosters_by_date`, {
        withCredentials: true,
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
      .get(`${API_BASE}/roster_meetings_by_date`, {
        withCredentials: true,
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
    this.setState({ showAllLessonPlans: false, showAllWeekly: false, showAllOneOff: false, showAllSchedule: false });
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
      {/* ✅ Desktop (lg+): 5 days on first row, Fri+Sat on second row */}
      <div className="d-none d-lg-block">
        <Row className="g-2">{[0, 1, 2, 3, 4].map(renderDayCol)}</Row>
        <Row className="g-2 mt-2">{[5, 6].map(renderDayCol)}</Row>
      </div>

      {/* ✅ Mobile/tablet: keep your current responsive behavior */}
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

  buildCreateLessonPlanLink = (cls) => {
  const params = new URLSearchParams();

  // always include selected date
  params.set("date", ymd(this.state.selectedDate));

  // include roster id when possible
  if (cls?.rosterId) params.set("roster_id", String(cls.rosterId));

  // optional context (safe even if your /new page ignores these)
  if (cls?.meetingId) params.set("meeting_id", String(cls.meetingId));
  if (cls?.starts_at) params.set("starts_at", String(cls.starts_at));
  if (cls?.ends_at) params.set("ends_at", String(cls.ends_at));
  if (cls?.location) params.set("location", String(cls.location));

  return `/lesson-plans/new?${params.toString()}`;
};

  /* ✅ calendar: smaller + cute/sleek */
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

  renderLessonPlansCard(selectedLabel) {
    const { occurrences, loading, error } = this.state;

    const lessonLimit = 5;
    const lessonAll = occurrences || [];
    const lessonVisible = this.state.showAllLessonPlans ? lessonAll : lessonAll.slice(0, lessonLimit);
    const lessonHiddenCount = Math.max(0, lessonAll.length - lessonVisible.length);

    return (
      <Card className="mt-3">
        <Card.Body>
          <Card.Title className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-left gap-2">
              <Button
                as={Link}
                to={`/lesson-plans/new?date=${ymd(this.state.selectedDate)}`}
                variant="primary"
              >
                + New
              </Button>
            </div>
          </Card.Title>

          {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
          {loading && <p className="mt-3">Loading…</p>}

          {!loading && !error && occurrences.length === 0 ? (
            <div className="text-muted mt-3">No lesson plans scheduled for this date.</div>
          ) : null}

          {!loading && !error && occurrences.length > 0 ? (
            <div className="d-grid mt-3" style={{ gap: 10 }}>
              {lessonVisible.map((occ) => (
                <div key={occ.id} className="d-flex justify-content-between">
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {occ.lesson_plan?.title || "Lesson plan"}
                    </div>

                    <div className="text-muted" style={{ fontSize: 13 }}>
                      {occ.starts_at || occ.ends_at
                        ? formatTimeRange(occ.starts_at, occ.ends_at)
                        : "No time set"}
                      {occ.location ? ` • ${occ.location}` : ""}
                    </div>
                  </div>

                  <div className="mt-2">
                    <Link to={`/lesson-plans/${occ.lesson_plan?.id}`} className="btn btn-outline-primary">
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {lessonHiddenCount > 0 && (
            <div className="d-flex justify-content-center mt-2">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => this.setState({ showAllLessonPlans: true })}
              >
                Show {lessonHiddenCount} more
              </Button>
            </div>
          )}

          {this.state.showAllLessonPlans && lessonAll.length > lessonLimit && (
            <div className="d-flex justify-content-center mt-2">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => this.setState({ showAllLessonPlans: false })}
              >
                Show less
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>
    );
  }

  render() {
    const { selectedDate } = this.state;
    const selectedLabel = selectedDate.toLocaleDateString();

    const weeklyLimit = 2;
    const oneOffLimit = 2;

    const weeklyAll = this.state.rosters || [];
    const oneOffAll = this.state.oneOffMeetings || [];

    const weeklyVisible = this.state.showAllWeekly ? weeklyAll : weeklyAll.slice(0, weeklyLimit);
    const oneOffVisible = this.state.showAllOneOff ? oneOffAll : oneOffAll.slice(0, oneOffLimit);

    const weeklyHiddenCount = Math.max(0, weeklyAll.length - weeklyVisible.length);
    const oneOffHiddenCount = Math.max(0, oneOffAll.length - oneOffVisible.length);

    return (
      <div className="container mt-4" style={{ maxWidth: 1100 }}>
        <div className="d-flex justify-content-between align-items-end mb-3 flex-wrap gap-2">
  <div>
    <h1 className="mb-1">Dashboard</h1>
    <div className="text-muted" style={{ fontSize: 14 }}>
      Welcome back{this.props.currentUser?.first_name ? `, ${this.props.currentUser.first_name}` : ""}.
    </div>
  </div>
</div>


        <Row>
          {/* ✅ SWAP: LEFT column now has calendar + schedules + lesson plans */}
          <Col md={5} className="mb-3">
            {this.renderCalendarMini()}

            {/* keep your height-sync wrapper on LEFT (since calendar is now left) */}
            <div
              style={{
                maxHeight: this.state.rightMaxHeight ?? "none",
                paddingRight: this.state.rightMaxHeight ? 6 : 0,
              }}
            >
             {/* ✅ Combined Day Agenda: classes (weekly + one-off) + nested lesson plans */}
<Card className="mt-3">
  <Card.Body>
    {(() => {
      const todayDow = selectedDate.getDay();

      // ---------- helpers ----------
      const timeKey = (v) => {
        if (!v) return null;

        // "HH:MM" / "HH:MM:SS"
        if (isHHMM(v)) {
          const [hh, mm] = v.split(":").map(Number);
          if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
          return hh * 60 + mm;
        }

        // ISO datetime
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return null;
        return d.getHours() * 60 + d.getMinutes();
      };

      const normalizeRosterId = (obj) =>
        obj?.roster?.id ?? obj?.roster_id ?? obj?.rosterId ?? null;

      // overlap: (start < end2) && (end > start2)
      const overlaps = (aStart, aEnd, bStart, bEnd) => {
        if (aStart == null || bStart == null) return false;

        const aE = aEnd == null ? aStart + 1 : aEnd; // if no end, treat as tiny block
        const bE = bEnd == null ? bStart + 1 : bEnd;

        return aStart < bE && aE > bStart;
      };

      // ---------- build class instances ----------
      const weeklyInstances = (this.state.rosters || []).flatMap((r) => {
        const todaysSchedules = Array.isArray(r.roster_schedules)
          ? r.roster_schedules.filter((s) => Number(s.weekday) === todayDow)
          : [];

        return todaysSchedules.map((s) => ({
          type: "weekly",
          roster: r,
          rosterId: r?.id ?? null,
          starts_at: s.starts_at,
          ends_at: s.ends_at,
          location: s.location,
          schedule: s,
        }));
      });

      const oneOffInstances = (this.state.oneOffMeetings || []).map((m) => ({
        type: "one-off",
        meeting: m,
        roster: m.roster,
        rosterId: normalizeRosterId(m),
        starts_at: m.starts_at,
        ends_at: m.ends_at,
        location: m.location,
        notes: m.notes,
      }));

      const classesAll = [...weeklyInstances, ...oneOffInstances].sort((a, b) => {
        const ta = timeKey(a.starts_at) ?? 99999;
        const tb = timeKey(b.starts_at) ?? 99999;
        if (ta !== tb) return ta - tb;
        if (a.type !== b.type) return a.type === "weekly" ? -1 : 1;
        return (a.roster?.name || "").localeCompare(b.roster?.name || "");
      });

      // ---------- match lesson plans to classes ----------
      const occAll = (this.state.occurrences || []).slice();

      // Each occurrence should have: lesson_plan.id/title + starts_at/ends_at + roster_id (preferred)
      const occWithKeys = occAll.map((occ) => {
        const rosterId = normalizeRosterId(occ);
        const s = timeKey(occ.starts_at);
        const e = timeKey(occ.ends_at);
        return { occ, rosterId, s, e };
      });

      // We'll assign each lesson plan occurrence to at most ONE class (first best match)
      const usedOccIds = new Set();

      const matchForClass = (cls) => {
        const clsRosterId = cls.rosterId ? String(cls.rosterId) : null;
        const clsS = timeKey(cls.starts_at);
        const clsE = timeKey(cls.ends_at);

        const matches = occWithKeys
          .filter(({ occ, rosterId, s, e }) => {
            if (!occ?.id) return false;
            if (usedOccIds.has(occ.id)) return false;

            // require roster match if occurrence has rosterId AND class has rosterId
            const occRosterId = rosterId ? String(rosterId) : null;
            if (clsRosterId && occRosterId && clsRosterId !== occRosterId) return false;

            // require overlap in time if both have time
            // If occurrence has no time, it won't match a specific class; it'll go to Other Lesson Plans
            if (s == null) return false;

            return overlaps(s, e, clsS, clsE);
          })
          .map(({ occ }) => occ);

        // mark used
        matches.forEach((o) => usedOccIds.add(o.id));
        return matches;
      };

      const classesEnriched = classesAll.map((cls) => ({
        ...cls,
        lessonPlans: matchForClass(cls),
      }));

      const otherLessonPlans = occAll.filter((occ) => occ?.id && !usedOccIds.has(occ.id));

      // ---------- counts + limits ----------
      const totalClasses = classesAll.length;
      const totalLessonPlans = occAll.length;

      const classLimit = 6;
      const visibleClasses = this.state.showAllSchedule ? classesEnriched : classesEnriched.slice(0, classLimit);
      const hiddenClassCount = Math.max(0, classesEnriched.length - visibleClasses.length);

      const otherLimit = 5;
      const otherVisible = this.state.showAllLessonPlans ? otherLessonPlans : otherLessonPlans.slice(0, otherLimit);
      const otherHiddenCount = Math.max(0, otherLessonPlans.length - otherVisible.length);

      // ---------- header ----------
      return (
        <>
         <Card.Title className="d-flex justify-content-between align-items-center mb-0">
  <SectionKicker>{formatHeaderDate(selectedDate)}</SectionKicker>

  <Badge
    bg="light"
    text="dark"
    pill
    className="px-2 py-1"
    style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}
  >
    {totalClasses}
  </Badge>
</Card.Title>


          {/* Errors/Loading */}
          {this.state.rostersError && <Alert variant="danger" className="mt-3">{this.state.rostersError}</Alert>}
          {this.state.oneOffError && <Alert variant="danger" className="mt-3">{this.state.oneOffError}</Alert>}
          {this.state.error && <Alert variant="danger" className="mt-3">{this.state.error}</Alert>}

          {(this.state.rostersLoading || this.state.oneOffLoading || this.state.loading) && (
            <p className="mt-3 text-muted">Loading…</p>
          )}

          {!this.state.rostersLoading &&
            !this.state.oneOffLoading &&
            !this.state.loading &&
            !this.state.rostersError &&
            !this.state.oneOffError &&
            !this.state.error && (
              <>
                {/* ---- Classes list ---- */}
                {classesEnriched.length === 0 ? (
                  <div className="text-muted mt-3">No classes/meetings for this day.</div>
                ) : (
                  <div className="d-grid mt-3" style={{ gap: 12 }}>
                    {visibleClasses.map((cls, idx) => {
  const rosterName = cls.roster?.name || "Roster";
  const rosterId = cls.rosterId;

  const tl = timeLabelShort(cls.starts_at, cls.ends_at);
  const mobileTime = formatTimeRange(cls.starts_at, cls.ends_at) || "Time TBD";

  return (
  <div
    key={`${cls.type}-${cls.starts_at || "na"}-${rosterId || idx}`}
    className="d-flex flex-column"
    style={{ gap: 8 }}
  >
    {/* ✅ MOBILE: TIME ROW ABOVE CARD (outside the card) */}
    <div className="d-md-none">
      <div className="d-flex align-items-center" style={{ gap: 10 }}>
        <div
          className="text-muted"
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.2,
            minWidth: 64,
            textAlign: "left"
          }}
        >
          {mobileTime}
        </div>

        <div
          aria-hidden="true"
          style={{
            height: 1,
            flex: 1,
            background: "#e9ecef"
          }}
        />
      </div>
    </div>

    {/* ✅ DESKTOP/TABLET ROW: time gutter + card */}
    <div className="d-flex align-items-stretch" style={{ gap: 12 }}>
      {/* LEFT TIME GUTTER (md+) */}
      <div
        className="d-none d-md-flex flex-column align-items-end position-relative"
        style={{
          width: 74,
          flex: "0 0 74px",
          paddingRight: 10
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
            background: "#e9ecef"
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
            background: "#ced4da"
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

      {/* RIGHT CARD */}
      <div
        className="border rounded-3 flex-grow-1"
        style={{
          padding: 14,
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.04)"
        }}
      >
        {/* Top row: name + badges */}
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div style={{ minWidth: 0 }}>
            {rosterId ? (
              <Link
                to={`/rosters/${rosterId}`}
                className="text-decoration-none"
                style={{ color: "inherit" }}
                title="View roster"
              >
                <div
                  style={{
                    fontWeight: 700,
                    wordBreak: "break-word",
                    lineHeight: 1.15,
                    cursor: "pointer"
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

            {/* ✅ REMOVE mobileTime from inside the card */}

            <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
              {cls.type === "weekly" ? (
                <Badge bg="light" text="dark" style={{ fontWeight: 600 }}>
                  weekly
                </Badge>
              ) : (
                <Badge bg="warning" text="dark" style={{ fontWeight: 600 }}>
                  one-off
                </Badge>
              )}
            </div>

            {cls.type === "one-off" && cls.notes ? (
              <div className="text-muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.25 }}>
                {cls.notes}
              </div>
            ) : null}
          </div>
        </div>

        {/* Divider + lesson plans ... (leave the rest exactly as you have it) */}
        <div
  style={{
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid rgba(0,0,0,0.06)",
  }}
>
  {(!cls.lessonPlans || cls.lessonPlans.length === 0) ? (
    <div
      style={{
        borderRadius: 12,
        border: "1px dashed rgba(0,0,0,0.12)",
        padding: 12,
        background: "rgba(0,0,0,0.02)",
      }}
    >
      <div className="text-muted" style={{ fontSize: 12 }}>
        No lesson plans scheduled for this class.
      </div>

      <div className="mt-2">
        <Button
          as={Link}
          to={this.buildCreateLessonPlanLink(cls)}
          variant="outline-secondary"
          size="sm"
          style={{
            padding: "6px 10px",
            fontSize: 12,
            borderRadius: 999,
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Create Lesson Plan
        </Button>
      </div>
    </div>
  ) : (
    <>
      <div className="text-muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
        Lesson Plan(s)
      </div>

      <div className="d-flex flex-wrap gap-2">
        {cls.lessonPlans.map((occ) => (
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
    </>
  )}
</div>

      </div>
    </div>
  </div>
);

})}

                  </div>
                )}

                {hiddenClassCount > 0 && (
                  <div className="d-flex justify-content-center mt-3">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => this.setState({ showAllSchedule: true })}
                    >
                      Show {hiddenClassCount} more classes
                    </Button>
                  </div>
                )}

                {this.state.showAllSchedule && classesEnriched.length > classLimit && (
                  <div className="d-flex justify-content-center mt-2">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => this.setState({ showAllSchedule: false })}
                    >
                      Show fewer classes
                    </Button>
                  </div>
                )}
              </>
            )}
        </>
      );
    })()}
  </Card.Body>
</Card>
</div>
</Col><br/>

          {/* ✅ SWAP: RIGHT column now has Now + My Students */}
          <Col md={7} className="mb-3">
            {this.renderWeeklyScheduleCard()}
            <MyStudentsCard />
          </Col>
        </Row>
      </div>
    );
  }
}
