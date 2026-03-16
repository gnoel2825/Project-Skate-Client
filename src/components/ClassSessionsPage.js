import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Card from "react-bootstrap/Card";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Badge from "react-bootstrap/Badge";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Spinner from "react-bootstrap/Spinner";
import { Link, useSearchParams } from "react-router-dom";

function ymd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatLongDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(dt);
}

function formatShortTime(value) {
  if (!value) return "";

  if (typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value.trim())) {
    const [hh, mm] = value.trim().split(":").map(Number);
    const hour = hh % 12 || 12;
    const suffix = hh >= 12 ? "PM" : "AM";
    return `${hour}:${String(mm).padStart(2, "0")} ${suffix}`;
  }

  if (typeof value === "string") {
    const match = value.match(/(?:T|\s)(\d{2}):(\d{2})(?::\d{2})?/);
    if (match) {
      const hh = Number(match[1]);
      const mm = Number(match[2]);
      const hour = hh % 12 || 12;
      const suffix = hh >= 12 ? "PM" : "AM";
      return `${hour}:${String(mm).padStart(2, "0")} ${suffix}`;
    }
    return String(value);
  }

  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTimeRange(start, end) {
  const s = formatShortTime(start);
  const e = formatShortTime(end);
  if (!s && !e) return "";
  if (s && !e) return s;
  if (!s && e) return e;
  return `${s} – ${e}`;
}

function fullName(student) {
  return [student?.first_name, student?.last_name].filter(Boolean).join(" ").trim();
}

function initialsForStudent(student) {
  const first = student?.first_name?.[0] || "";
  const last = student?.last_name?.[0] || "";
  return `${first}${last}`.toUpperCase() || "S";
}

function safeMessage(err, fallback) {
  return (
    err?.response?.data?.errors?.join(", ") ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
}

function occurrenceRowsEqual(a = [], b = []) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeAttendanceRowsFromOccurrence(session) {
  const rows = [];
  const seen = new Set();

  (session?.matching_rosters || []).forEach((roster) => {
    (roster?.students || []).forEach((student) => {
      if (seen.has(student.id)) return;
      seen.add(student.id);

      rows.push({
        student_id: student.id,
        first_name: student.first_name || "",
        last_name: student.last_name || "",
        email: student.email || "",
        status: student.attendance?.status || "",
        notes: student.attendance?.notes || "",
      });
    });
  });

  return rows.sort((a, b) => {
    const last = a.last_name.localeCompare(b.last_name);
    if (last !== 0) return last;
    return a.first_name.localeCompare(b.first_name);
  });
}

function sessionDisplayTitle(session) {
  const rosterName = session?.matching_rosters?.[0]?.name;
  const explicitRosterName = session?.roster?.name;
  return explicitRosterName || rosterName || "Class Session";
}

function parseTimeToMinutes(value) {
  if (!value) return null;

  if (typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value.trim())) {
    const [hh, mm] = value.trim().split(":").map(Number);
    return hh * 60 + mm;
  }

  if (typeof value === "string") {
    const match = value.match(/(?:T|\s)(\d{2}):(\d{2})(?::\d{2})?/);
    if (match) return Number(match[1]) * 60 + Number(match[2]);
  }

  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) return dt.getHours() * 60 + dt.getMinutes();

  return null;
}

function weekdayFromDate(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getDay();
}

function rosterScheduleLabel(roster) {
  const sch = Array.isArray(roster?.roster_schedules) ? roster.roster_schedules : [];
  if (!sch.length) return "No weekly schedule";

  const weekdayShort = (n) =>
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][Number(n)] || "";

  return sch
    .slice(0, 2)
    .map((s) => {
      const day = weekdayShort(s.weekday);
      const time = formatTimeRange(s.starts_at, s.ends_at);
      return [day, time].filter(Boolean).join(" ");
    })
    .join(" • ");
}

function getCandidateRosters(session, allRosters) {
  const targetWeekday = weekdayFromDate(session?.taught_on);
  const targetStart = parseTimeToMinutes(session?.starts_at);
  const targetEnd = parseTimeToMinutes(session?.ends_at);

  if (targetWeekday == null || targetStart == null || targetEnd == null) return [];

  const exactIds = new Set((session?.matching_rosters || []).map((r) => r.id));
  if (session?.roster_id) exactIds.add(session.roster_id);

  return (allRosters || [])
    .filter((roster) => !exactIds.has(roster.id))
    .map((roster) => {
      const schedules = Array.isArray(roster?.roster_schedules) ? roster.roster_schedules : [];
      const sameDay = schedules.filter((s) => Number(s.weekday) === Number(targetWeekday));
      if (!sameDay.length) return null;

      const closest = sameDay
        .map((s) => {
          const sStart = parseTimeToMinutes(s.starts_at);
          const sEnd = parseTimeToMinutes(s.ends_at);
          if (sStart == null || sEnd == null) return null;

          const distance = Math.abs(sStart - targetStart) + Math.abs(sEnd - targetEnd);

          return { roster, schedule: s, distance };
        })
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance)[0];

      return closest || null;
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);
}

function getSessionStatus(session, allRosters) {
  const hasExplicitRoster = !!session?.roster_id;
  const hasMatchingRoster = (session?.matching_rosters || []).length > 0;
  const candidates = getCandidateRosters(session, allRosters);

  if (hasExplicitRoster || hasMatchingRoster) return "ready";
  if (candidates.length > 0) return "needs_rescheduling";
  return "needs_roster";
}

function sessionStatusMeta(status) {
  switch (status) {
    case "ready":
      return {
        label: "Ready",
        bg: "rgba(25,135,84,0.10)",
        border: "rgba(25,135,84,0.2)",
        color: "#198754",
      };
    case "needs_rescheduling":
      return {
        label: "Needs rescheduling",
        bg: "rgba(255,193,7,0.14)",
        border: "rgba(255,193,7,0.22)",
        color: "#9a6700",
      };
    default:
      return {
        label: "Needs roster",
        bg: "rgba(220,53,69,0.08)",
        border: "rgba(220,53,69,0.18)",
        color: "#dc3545",
      };
  }
}

function SessionStatusBadge({ status }) {
  const meta = sessionStatusMeta(status);
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 999,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.color,
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}

function AttendancePill({ active, children, onClick, disabled, variant = "outline-secondary" }) {
  return (
    <Button
      size="sm"
      variant={active ? "primary" : variant}
      onClick={onClick}
      disabled={disabled}
      className="rounded-pill px-3"
      style={{ fontSize: 12 }}
    >
      {children}
    </Button>
  );
}

function SessionSummaryCard({ session, allRosters, onJumpToResolution }) {
  const lessonPlan = session?.lesson_plan || {};
  const attendanceSummary = session?.attendance_summary || {};
  const status = getSessionStatus(session, allRosters);
  const linkedRoster = session?.matching_rosters?.[0] || null;
  const totalStudents =
    linkedRoster?.student_count ||
    (linkedRoster?.students ? linkedRoster.students.length : 0) ||
    attendanceSummary.total ||
    0;

  return (
    <Card className="border-0 shadow-sm mb-3">
      <Card.Body>
        <div
          className="border rounded-4 p-3"
          style={{ background: "#fcfcff", borderColor: "#e9ecef" }}
        >
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <div className="fw-semibold" style={{ fontSize: 14 }}>
              Session Details
            </div>
            <SessionStatusBadge status={status} />
          </div>

          <div className="mb-2" style={{ fontSize: 14 }}>
            <div className="text-muted" style={{ fontSize: 12 }}>
              Lesson Plan
            </div>
            <div className="fw-semibold">
              {lessonPlan?.id ? (
                <Link to={`/lesson-plans/${lessonPlan.id}`} className="text-decoration-none">
                  {lessonPlan.title || "Untitled lesson plan"}
                </Link>
              ) : (
                lessonPlan.title || "Untitled lesson plan"
              )}
            </div>
          </div>

          <div className="mb-2" style={{ fontSize: 14 }}>
            <div className="text-muted" style={{ fontSize: 12 }}>
              Roster
            </div>
            <div className="fw-semibold">
              {linkedRoster?.id ? (
                <Link to={`/rosters/${linkedRoster.id}`} className="text-decoration-none">
                  {linkedRoster.name}
                </Link>
              ) : (
                "Not linked yet"
              )}
            </div>
          </div>

          <div className="mb-3 text-muted" style={{ fontSize: 13 }}>
            {[formatTimeRange(session.starts_at, session.ends_at), session.location]
              .filter(Boolean)
              .join(" • ")}
          </div>

          {lessonPlan.description ? (
            <div className="text-muted mb-3" style={{ fontSize: 13, lineHeight: 1.45 }}>
              {lessonPlan.description}
            </div>
          ) : null}

          <div className="text-muted mb-2" style={{ fontSize: 12 }}>
            Attendance Snapshot
          </div>

          <div className="d-flex flex-wrap gap-2">
            <Badge bg="light" text="dark" className="border">
              {totalStudents} Student{totalStudents === 1 ? "" : "s"}
            </Badge>
            <Badge bg="light" text="dark" className="border">
              Present {attendanceSummary.present || 0}
            </Badge>
            <Badge bg="light" text="dark" className="border">
              Late {attendanceSummary.late || 0}
            </Badge>
            <Badge bg="light" text="dark" className="border">
              Absent {attendanceSummary.absent || 0}
            </Badge>
            <Badge bg="light" text="dark" className="border">
              Excused {attendanceSummary.excused || 0}
            </Badge>
          </div>

          {status !== "ready" ? (
            <div className="mt-3">
              <Button
                size="sm"
                variant="primary"
                className="rounded-pill px-3"
                style={{ fontSize: 12 }}
                onClick={onJumpToResolution}
              >
                Resolve Session
              </Button>
            </div>
          ) : null}
        </div>
      </Card.Body>
    </Card>
  );
}

function SessionPlanCard({ session }) {
  const lessonPlan = session?.lesson_plan || {};
  const warmupSkills = lessonPlan.warmup_skills || [];
  const mainSkills = lessonPlan.skills || [];
  const cooldownSkills = lessonPlan.cooldown_skills || [];

  const SkillList = ({ title, skills, notes }) => (
    <Card className="border-0 shadow-sm mb-3">
      <Card.Body>
        <div className="d-flex align-items-center gap-2 mb-2">
          <div className="text-uppercase text-muted" style={{ fontSize: 11, letterSpacing: 0.6 }}>
            {title}
          </div>
          <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
          <Badge bg="light" text="dark" className="border">
            {skills.length}
          </Badge>
        </div>

        {notes ? (
          <div
            className="border rounded-3 p-3 mb-3"
            style={{
              background: "#fcfcff",
              borderColor: "#e9ecef",
              whiteSpace: "pre-wrap",
              fontSize: 14,
            }}
          >
            {notes}
          </div>
        ) : (
          <div className="text-muted mb-3" style={{ fontSize: 14 }}>
            No notes.
          </div>
        )}

        {skills.length === 0 ? (
          <div className="text-muted" style={{ fontSize: 14 }}>
            No skills listed.
          </div>
        ) : (
          <div className="d-grid" style={{ gap: 8 }}>
            {skills.map((skill) => (
              <div
                key={`${title}-${skill.id}`}
                className="border rounded-3 px-3 py-2"
                style={{ background: "#fff", borderColor: "#e9ecef" }}
              >
                <strong>Basic {skill.level}</strong> — {skill.name}
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );

  return (
    <>
      <SkillList title="Warm-up" skills={warmupSkills} notes={lessonPlan.warmup_notes} />
      <SkillList title="Main Lesson" skills={mainSkills} notes={lessonPlan.main_notes} />
      <SkillList title="Cool-down" skills={cooldownSkills} notes={lessonPlan.cooldown_notes} />
    </>
  );
}

function RosterAttendanceCard({
  session,
  rows,
  saving,
  dirty,
  onChangeStatus,
  onChangeNotes,
  onSave,
  onMarkAllPresent,
}) {
  const rosters = session?.matching_rosters || [];
  const totalStudents = rows.length;

  return (
    <Card className="border-0 shadow-sm">
      <Card.Body>
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
          <div>
            <div className="text-uppercase text-muted mb-1" style={{ fontSize: 11, letterSpacing: 0.6 }}>
              Roster & Attendance
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              {rosters.length ? (
                rosters.map((roster) => (
                  <Badge
                    key={roster.id}
                    bg="light"
                    text="dark"
                    className="border"
                    style={{ fontWeight: 500 }}
                  >
                    {roster.name}
                  </Badge>
                ))
              ) : (
                <div className="text-muted">No matching rosters found.</div>
              )}

              <Badge bg="light" text="dark" className="border">
                {totalStudents} Student{totalStudents === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>

          <div className="d-flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline-secondary"
              className="rounded-pill px-3"
              style={{ fontSize: 12 }}
              onClick={onMarkAllPresent}
              disabled={saving || rows.length === 0}
            >
              Mark All Present
            </Button>

            <Button
              size="sm"
              variant={dirty ? "primary" : "secondary"}
              className="rounded-pill px-3"
              style={{ fontSize: 12 }}
              onClick={onSave}
              disabled={saving || !dirty}
            >
              {saving ? "Saving..." : dirty ? "Save Attendance" : "Saved"}
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="text-muted border rounded-3 p-3" style={{ background: "#fbfbfd" }}>
            No students found for this session.
          </div>
        ) : (
          <div className="d-grid" style={{ gap: 10 }}>
            {rows.map((row) => (
              <div
                key={row.student_id}
                className="border rounded-3 p-3"
                style={{ background: "#fff", borderColor: "#e9ecef" }}
              >
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
                    <div className="d-flex align-items-center gap-3" style={{ minWidth: 0 }}>
                      <div
                        className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                        style={{
                          width: 36,
                          height: 36,
                          background: "#eef2ff",
                          color: "#3b5bdb",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {initialsForStudent(row)}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div className="fw-semibold" style={{ fontSize: 14 }}>
                          <Link to={`/students/${row.student_id}`} className="text-decoration-none">
                            {fullName(row)}
                          </Link>
                        </div>

                        <div className="text-muted" style={{ fontSize: 13 }}>
                          {row.email || "No email"}
                        </div>
                      </div>
                    </div>

                    <div className="d-flex flex-wrap gap-2">
                      <AttendancePill
                        active={row.status === "present"}
                        onClick={() => onChangeStatus(row.student_id, "present")}
                        disabled={saving}
                      >
                        Present
                      </AttendancePill>

                      <AttendancePill
                        active={row.status === "late"}
                        onClick={() => onChangeStatus(row.student_id, "late")}
                        disabled={saving}
                      >
                        Late
                      </AttendancePill>

                      <AttendancePill
                        active={row.status === "absent"}
                        onClick={() => onChangeStatus(row.student_id, "absent")}
                        disabled={saving}
                      >
                        Absent
                      </AttendancePill>

                      <AttendancePill
                        active={row.status === "excused"}
                        onClick={() => onChangeStatus(row.student_id, "excused")}
                        disabled={saving}
                      >
                        Excused
                      </AttendancePill>

                      <AttendancePill
                        active={!row.status}
                        onClick={() => onChangeStatus(row.student_id, "")}
                        disabled={saving}
                        variant="outline-light"
                      >
                        Clear
                      </AttendancePill>
                    </div>
                  </div>

                  <Form.Control
                    placeholder="Optional attendance note..."
                    value={row.notes}
                    disabled={saving}
                    onChange={(e) => onChangeNotes(row.student_id, e.target.value)}
                    style={{ borderRadius: 12 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

function SessionResolutionCard({
  session,
  allRosters,
  resolving,
  onLinkRoster,
  onCreateMeetingAndLink,
  onReschedule,
}) {
  const candidates = getCandidateRosters(session, allRosters);
  const status = getSessionStatus(session, allRosters);
  const [selectedRosterId, setSelectedRosterId] = useState(
    session?.matching_rosters?.[0]?.id || candidates[0]?.roster?.id || ""
  );
  const [rescheduleDate, setRescheduleDate] = useState(session?.taught_on || "");
  const [rescheduleStart, setRescheduleStart] = useState(
    typeof session?.starts_at === "string" && /^\d{2}:\d{2}/.test(session.starts_at)
      ? session.starts_at.slice(0, 5)
      : ""
  );
  const [rescheduleEnd, setRescheduleEnd] = useState(
    typeof session?.ends_at === "string" && /^\d{2}:\d{2}/.test(session.ends_at)
      ? session.ends_at.slice(0, 5)
      : ""
  );

  const rosterOptions = useMemo(() => {
    const used = new Set();
    const merged = [];

    candidates.forEach((c) => {
      if (!used.has(c.roster.id)) {
        used.add(c.roster.id);
        merged.push(c.roster);
      }
    });

    (allRosters || []).forEach((roster) => {
      if (!used.has(roster.id)) {
        used.add(roster.id);
        merged.push(roster);
      }
    });

    return merged;
  }, [allRosters, candidates]);

  return (
    <Card className="border-0 shadow-sm mb-3">
      <Card.Body>
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
          <div>
            <div className="text-uppercase text-muted mb-1" style={{ fontSize: 11, letterSpacing: 0.6 }}>
              Session Resolution
            </div>
            <div className="fw-semibold" style={{ fontSize: 20 }}>
              {status === "needs_rescheduling"
                ? "This session likely needs to be rescheduled to match a roster"
                : "This session needs a roster before attendance can be taken"}
            </div>
            <div className="text-muted mt-2" style={{ fontSize: 14 }}>
              Link this lesson plan occurrence to a roster, create a one-off meeting for the roster,
              or reschedule the occurrence so it aligns with the intended class time.
            </div>
          </div>

          <div className="align-self-start">
            <SessionStatusBadge status={status} />
          </div>
        </div>

        {candidates.length > 0 ? (
          <div
            className="border rounded-4 p-3 mb-3"
            style={{ background: "#fcfcff", borderColor: "#e9ecef" }}
          >
            <div className="fw-semibold mb-2" style={{ fontSize: 14 }}>
              Suggested rosters
            </div>

            <div className="d-grid" style={{ gap: 10 }}>
              {candidates.map((candidate) => (
                <div
                  key={candidate.roster.id}
                  className="border rounded-3 p-3"
                  style={{ background: "#fff", borderColor: "#e9ecef" }}
                >
                  <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
                    <div>
                      <div className="fw-semibold">{candidate.roster.name}</div>
                      <div className="text-muted" style={{ fontSize: 13 }}>
                        {rosterScheduleLabel(candidate.roster)}
                      </div>
                      <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                        Close weekday/time match for this session.
                      </div>
                    </div>

                    <div className="d-flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="rounded-pill px-3"
                        style={{ fontSize: 12 }}
                        disabled={resolving}
                        onClick={() => onLinkRoster(candidate.roster)}
                      >
                        Link to Roster
                      </Button>

                      <Button
                        size="sm"
                        variant="primary"
                        className="rounded-pill px-3"
                        style={{ fontSize: 12 }}
                        disabled={resolving}
                        onClick={() => onCreateMeetingAndLink(candidate.roster)}
                      >
                        Add One-Off Meeting + Link
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <Row className="g-3">
          <Col xl={6}>
            <Card className="border h-100" style={{ borderColor: "#e9ecef" }}>
              <Card.Body>
                <div className="fw-semibold mb-2" style={{ fontSize: 15 }}>
                  Link this session to a roster
                </div>
                <div className="text-muted mb-3" style={{ fontSize: 13 }}>
                  Choose a roster now if this occurrence already belongs to a known class.
                </div>

                <Form.Select
                  value={selectedRosterId}
                  onChange={(e) => setSelectedRosterId(e.target.value)}
                  style={{ borderRadius: 12 }}
                  className="mb-3"
                >
                  <option value="">Choose a roster…</option>
                  {rosterOptions.map((roster) => (
                    <option key={roster.id} value={roster.id}>
                      {roster.name} — {rosterScheduleLabel(roster)}
                    </option>
                  ))}
                </Form.Select>

                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    variant="outline-secondary"
                    className="rounded-pill px-3"
                    style={{ fontSize: 12 }}
                    disabled={resolving || !selectedRosterId}
                    onClick={() => {
                      const roster = rosterOptions.find((r) => String(r.id) === String(selectedRosterId));
                      if (roster) onLinkRoster(roster);
                    }}
                  >
                    Link to Roster
                  </Button>

                  <Button
                    variant="primary"
                    className="rounded-pill px-3"
                    style={{ fontSize: 12 }}
                    disabled={resolving || !selectedRosterId}
                    onClick={() => {
                      const roster = rosterOptions.find((r) => String(r.id) === String(selectedRosterId));
                      if (roster) onCreateMeetingAndLink(roster);
                    }}
                  >
                    Create One-Off Meeting + Link
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xl={6}>
            <Card className="border h-100" style={{ borderColor: "#e9ecef" }}>
              <Card.Body>
                <div className="fw-semibold mb-2" style={{ fontSize: 15 }}>
                  Reschedule this session
                </div>
                <div className="text-muted mb-3" style={{ fontSize: 13 }}>
                  If this was meant to line up with a roster by date/time, move it so it matches cleanly.
                </div>

                <Row className="g-2 mb-3">
                  <Col md={4}>
                    <Form.Control
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      style={{ borderRadius: 12 }}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Control
                      type="time"
                      value={rescheduleStart}
                      onChange={(e) => setRescheduleStart(e.target.value)}
                      style={{ borderRadius: 12 }}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Control
                      type="time"
                      value={rescheduleEnd}
                      onChange={(e) => setRescheduleEnd(e.target.value)}
                      style={{ borderRadius: 12 }}
                    />
                  </Col>
                </Row>

                <Button
                  variant="outline-secondary"
                  className="rounded-pill px-3"
                  style={{ fontSize: 12 }}
                  disabled={resolving || !rescheduleDate || !rescheduleStart || !rescheduleEnd}
                  onClick={() =>
                    onReschedule({
                      taught_on: rescheduleDate,
                      starts_at: rescheduleStart,
                      ends_at: rescheduleEnd,
                    })
                  }
                >
                  Reschedule Session
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}

export default function ClassSessionsDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = searchParams.get("date") || ymd(new Date());

  const [showAllSessions, setShowAllSessions] = useState(false);

  const [date, setDate] = useState(initialDate);
  const [sessions, setSessions] = useState([]);
  const [allRosters, setAllRosters] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  const [attendanceDrafts, setAttendanceDrafts] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [resolvingSession, setResolvingSession] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const visibleSessions = useMemo(() => {
    return sessions
      .slice()
      .sort((a, b) => {
        const ta = parseTimeToMinutes(a.starts_at) ?? 99999;
        const tb = parseTimeToMinutes(b.starts_at) ?? 99999;
        return ta - tb;
      });
  }, [sessions]);

  const selectedSession = useMemo(
    () =>
      visibleSessions.find((s) => String(s.id) === String(selectedSessionId)) ||
      visibleSessions[0] ||
      null,
    [visibleSessions, selectedSessionId]
  );

  useEffect(() => {
    setSearchParams({ date });
  }, [date, setSearchParams]);

  const loadSessions = async (targetDate = date) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const [sessionRes, rosterRes] = await Promise.all([
        api.get("/lesson_plans_by_date", { params: { date: targetDate } }),
        api.get("/rosters.json"),
      ]);

      const data = Array.isArray(sessionRes.data) ? sessionRes.data : [];
      const rosters = Array.isArray(rosterRes.data) ? rosterRes.data : [];

      setSessions(data);
      setAllRosters(rosters);

      const drafts = {};
      data.forEach((session) => {
        drafts[session.id] = normalizeAttendanceRowsFromOccurrence(session);
      });
      setAttendanceDrafts(drafts);

      if (data.length > 0) {
        setSelectedSessionId((prev) =>
          data.some((s) => String(s.id) === String(prev)) ? prev : data[0].id
        );
      } else {
        setSelectedSessionId(null);
      }
    } catch (err) {
      setError(safeMessage(err, "Failed to load class sessions"));
      setSessions([]);
      setAttendanceDrafts({});
      setSelectedSessionId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const selectedRows = selectedSession ? attendanceDrafts[selectedSession.id] || [] : [];
  const originalSelectedRows = selectedSession
    ? normalizeAttendanceRowsFromOccurrence(selectedSession)
    : [];

  const attendanceDirty = !occurrenceRowsEqual(selectedRows, originalSelectedRows);

  const updateAttendanceRow = (studentId, patch) => {
    if (!selectedSession) return;

    setAttendanceDrafts((prev) => ({
      ...prev,
      [selectedSession.id]: (prev[selectedSession.id] || []).map((row) =>
        row.student_id === studentId ? { ...row, ...patch } : row
      ),
    }));
    setSuccess("");
    setError("");
  };

  const markAllPresent = () => {
    if (!selectedSession) return;

    setAttendanceDrafts((prev) => ({
      ...prev,
      [selectedSession.id]: (prev[selectedSession.id] || []).map((row) => ({
        ...row,
        status: "present",
      })),
    }));
    setSuccess("");
    setError("");
  };

  const saveAttendance = async () => {
    if (!selectedSession) return;

    setSavingAttendance(true);
    setError("");
    setSuccess("");

    try {
      await api.post(
        `/lesson_plans/${selectedSession.lesson_plan.id}/lesson_plan_occurrences/${selectedSession.id}/save_attendance`,
        {
          attendance: (attendanceDrafts[selectedSession.id] || []).map((row) => ({
            student_id: row.student_id,
            status: row.status || null,
            notes: row.notes || null,
          })),
        }
      );

      setSuccess("Attendance saved.");
      await loadSessions(date);
    } catch (err) {
      setError(safeMessage(err, "Failed to save attendance"));
    } finally {
      setSavingAttendance(false);
    }
  };

  const linkOccurrenceToRoster = async (roster) => {
    if (!selectedSession || !roster) return;

    setResolvingSession(true);
    setError("");
    setSuccess("");

    try {
      await api.patch(
        `/lesson_plans/${selectedSession.lesson_plan.id}/lesson_plan_occurrences/${selectedSession.id}`,
        {
          lesson_plan_occurrence: {
            roster_id: roster.id,
          },
        }
      );

      setSuccess(`Linked session to ${roster.name}.`);
      await loadSessions(date);
    } catch (err) {
      setError(safeMessage(err, "Failed to link session to roster"));
    } finally {
      setResolvingSession(false);
    }
  };

  const createOneOffMeetingAndLink = async (roster) => {
    if (!selectedSession || !roster) return;

    setResolvingSession(true);
    setError("");
    setSuccess("");

    try {
      await api.post(`/rosters/${roster.id}/roster_meetings`, {
        roster_meeting: {
          taught_on: selectedSession.taught_on,
          starts_at: selectedSession.starts_at,
          ends_at: selectedSession.ends_at,
          location: selectedSession.location || "",
        },
      });

      await api.patch(
        `/lesson_plans/${selectedSession.lesson_plan.id}/lesson_plan_occurrences/${selectedSession.id}`,
        {
          lesson_plan_occurrence: {
            roster_id: roster.id,
          },
        }
      );

      setSuccess(`Created one-off meeting and linked session to ${roster.name}.`);
      await loadSessions(date);
    } catch (err) {
      setError(safeMessage(err, "Failed to create one-off meeting and link session"));
    } finally {
      setResolvingSession(false);
    }
  };

  const rescheduleOccurrence = async (attrs) => {
    if (!selectedSession) return;

    setResolvingSession(true);
    setError("");
    setSuccess("");

    try {
      await api.patch(
        `/lesson_plans/${selectedSession.lesson_plan.id}/lesson_plan_occurrences/${selectedSession.id}`,
        {
          lesson_plan_occurrence: attrs,
        }
      );

      setSuccess("Session rescheduled.");
      await loadSessions(attrs.taught_on || date);
      if (attrs.taught_on) setDate(attrs.taught_on);
    } catch (err) {
      setError(safeMessage(err, "Failed to reschedule session"));
    } finally {
      setResolvingSession(false);
    }
  };

  const selectedStatus = selectedSession ? getSessionStatus(selectedSession, allRosters) : null;

  return (
    <div className="container mt-4" style={{ maxWidth: 1320 }}>
      <div className="d-flex flex-column flex-xl-row justify-content-between align-items-xl-center gap-3 mb-4">
        <div>
          <div className="text-uppercase text-muted" style={{ fontSize: 11, letterSpacing: 0.6 }}>
            Class Sessions
          </div>
          <h1 className="h3 mb-1">Attendance</h1>
          <div className="text-muted">
            {loading
              ? "Loading sessions..."
              : `${sessions.length} session${sessions.length === 1 ? "" : "s"} on ${formatLongDate(date)}.`}
          </div>
        </div>

        <div className="d-flex gap-2 align-items-center flex-wrap">
          <Form.Control
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ maxWidth: 200, borderRadius: 12 }}
          />
        </div>
      </div>

      {success ? <Alert variant="success">{success}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {loading ? (
        <div className="py-5 text-center">
          <Spinner animation="border" />
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4">
            <div className="fw-semibold mb-2">No class sessions found</div>
            <div className="text-muted">
              There are no scheduled lesson plan sessions for this date.
            </div>
          </Card.Body>
        </Card>
      ) : (
       <>
  <Card className="border-0 shadow-sm mb-3">
    <Card.Body>
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-2 mb-3">
        <div>
          <div
            className="text-uppercase text-muted"
            style={{ fontSize: 11, letterSpacing: 0.6 }}
          >
            Sessions
          </div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {visibleSessions.length} time slot{visibleSessions.length === 1 ? "" : "s"}
          </div>
        </div>

        {visibleSessions.length > 5 ? (
          <Button
            size="sm"
            variant="outline-secondary"
            className="rounded-pill px-3"
            style={{ fontSize: 12 }}
            onClick={() => setShowAllSessions((v) => !v)}
          >
            {showAllSessions ? "Show Less" : `Show All (${visibleSessions.length})`}
          </Button>
        ) : null}
      </div>

      <div className="d-flex flex-wrap gap-2">
        {(showAllSessions ? visibleSessions : visibleSessions.slice(0, 5)).map((session) => {
          const active = String(selectedSession?.id) === String(session.id);
          const status = getSessionStatus(session, allRosters);

          return (
            <Button
              key={session.id}
              variant={active ? "primary" : "outline-secondary"}
              className="rounded-pill px-3"
              style={{ fontSize: 12 }}
              onClick={() => setSelectedSessionId(session.id)}
            >
              <span className="d-inline-flex align-items-center gap-2">
                <span>{formatTimeRange(session.starts_at, session.ends_at) || "Time TBD"}</span>
                {status !== "ready" ? (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background:
                        status === "needs_rescheduling" ? "#ffc107" : "#dc3545",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                ) : null}
              </span>
            </Button>
          );
        })}
      </div>
    </Card.Body>
  </Card>

  {selectedSession ? (
    <>
      <SessionSummaryCard
        session={selectedSession}
        allRosters={allRosters}
        onJumpToResolution={() => {
          const el = document.getElementById("session-resolution-card");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      {selectedStatus !== "ready" ? (
        <div id="session-resolution-card">
          <SessionResolutionCard
            session={selectedSession}
            allRosters={allRosters}
            resolving={resolvingSession}
            onLinkRoster={linkOccurrenceToRoster}
            onCreateMeetingAndLink={createOneOffMeetingAndLink}
            onReschedule={rescheduleOccurrence}
          />
        </div>
      ) : null}

      {selectedStatus === "ready" ? (
        <RosterAttendanceCard
          session={selectedSession}
          rows={selectedRows}
          saving={savingAttendance}
          dirty={attendanceDirty}
          onChangeStatus={(studentId, status) =>
            updateAttendanceRow(studentId, { status })
          }
          onChangeNotes={(studentId, notes) =>
            updateAttendanceRow(studentId, { notes })
          }
          onSave={saveAttendance}
          onMarkAllPresent={markAllPresent}
        />
      ) : (
        <Card className="border-0 shadow-sm mb-3">
          <Card.Body>
            <div className="fw-semibold mb-2">
              Attendance unavailable until session is resolved
            </div>
            <div className="text-muted" style={{ fontSize: 14 }}>
              Link this occurrence to a roster, add a one-off roster meeting, or
              reschedule the occurrence so students can be loaded for attendance.
            </div>
          </Card.Body>
        </Card>
      )}

      <SessionPlanCard session={selectedSession} />
    </>
  ) : null}
</>
      )}
    </div>
  );
}