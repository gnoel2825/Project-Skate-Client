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
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(String(value))) {
    const [hh, mm] = String(value).split(":").map(Number);
    const dt = new Date(2000, 0, 1, hh, mm || 0, 0);
    return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
  const timeLabel = formatShortTime(session?.starts_at);

  if (timeLabel && rosterName) return `Session at ${timeLabel} • ${rosterName}`;
  if (timeLabel) return `Session at ${timeLabel}`;
  if (rosterName) return `Session • ${rosterName}`;
  return "Class Session";
}

function skillPreview(session) {
  const lessonPlan = session?.lesson_plan || {};
  const warmup = lessonPlan.warmup_skills || [];
  const main = lessonPlan.skills || [];
  const cooldown = lessonPlan.cooldown_skills || [];

  const all = [...warmup, ...main, ...cooldown];
  const unique = [];
  const seen = new Set();

  all.forEach((skill) => {
    if (seen.has(skill.id)) return;
    seen.add(skill.id);
    unique.push(skill);
  });

  return unique.slice(0, 6);
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

function SessionSummaryCard({ session }) {
  const lessonPlan = session?.lesson_plan || {};
  const previewSkills = skillPreview(session);
  const attendanceSummary = session?.attendance_summary || {};

  return (
    <Card className="border-0 shadow-sm mb-3">
      <Card.Body>
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
          <div>
            <div className="text-uppercase text-muted mb-1" style={{ fontSize: 11, letterSpacing: 0.6 }}>
              Class Session
            </div>

            <div className="fw-semibold" style={{ fontSize: 22, lineHeight: 1.2 }}>
              {sessionDisplayTitle(session)}
            </div>

            <div className="text-muted mt-2" style={{ fontSize: 14 }}>
              {formatLongDate(session.taught_on)}
              {formatTimeRange(session.starts_at, session.ends_at)
                ? ` • ${formatTimeRange(session.starts_at, session.ends_at)}`
                : ""}
              {session.location ? ` • ${session.location}` : ""}
            </div>
          </div>

          <div
            className="border rounded-4 p-3"
            style={{ minWidth: 320, background: "#fcfcff", borderColor: "#e9ecef" }}
          >
            <div className="mb-2 fw-semibold" style={{ fontSize: 14 }}>
              Session Details
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
    lessonPlan.title || "No lesson plan title"
  )}
</div>
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
              <Badge bg="light" text="dark" className="border">Total {attendanceSummary.total || 0}</Badge>
              <Badge bg="light" text="dark" className="border">Present {attendanceSummary.present || 0}</Badge>
              <Badge bg="light" text="dark" className="border">Late {attendanceSummary.late || 0}</Badge>
              <Badge bg="light" text="dark" className="border">Absent {attendanceSummary.absent || 0}</Badge>
              <Badge bg="light" text="dark" className="border">Excused {attendanceSummary.excused || 0}</Badge>
            </div>
          </div>
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
}) {
  const rosters = session?.matching_rosters || [];

  return (
    <Card className="border-0 shadow-sm">
      <Card.Body>
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
          <div>
            <div className="text-uppercase text-muted mb-1" style={{ fontSize: 11, letterSpacing: 0.6 }}>
              Roster & Attendance
            </div>

            {rosters.length ? (
              <div className="d-flex flex-wrap gap-2">
                {rosters.map((roster) => (
                  <Badge
                    key={roster.id}
                    bg="light"
                    text="dark"
                    className="border"
                    style={{ fontWeight: 500 }}
                  >
                    {roster.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="text-muted">No matching rosters found.</div>
            )}
          </div>

          <Button
            size="sm"
            variant={dirty ? "primary" : "secondary"}
            className="rounded-pill px-3 align-self-start"
            style={{ fontSize: 12 }}
            onClick={onSave}
            disabled={saving || !dirty}
          >
            {saving ? "Saving..." : dirty ? "Save Attendance" : "Saved"}
          </Button>
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
                          <Link
                            to={`/students/${row.student_id}`}
                            className="text-decoration-none"
                          >
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

export default function ClassSessionsDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = searchParams.get("date") || ymd(new Date());

  const [date, setDate] = useState(initialDate);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  const [attendanceDrafts, setAttendanceDrafts] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedSession = useMemo(
    () => sessions.find((s) => String(s.id) === String(selectedSessionId)) || sessions[0] || null,
    [sessions, selectedSessionId]
  );

  useEffect(() => {
    setSearchParams({ date });
  }, [date, setSearchParams]);

  const loadSessions = async (targetDate = date) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.get("/lesson_plans_by_date", {
        params: { date: targetDate },
      });

      const data = Array.isArray(res.data) ? res.data : [];
      setSessions(data);

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

  return (
    <div className="container mt-4" style={{ maxWidth: 1240 }}>
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
        <div>
          <div className="text-uppercase text-muted" style={{ fontSize: 11, letterSpacing: 0.6 }}>
            Class Sessions
          </div>
          <h1 className="h3 mb-1">Attendance</h1>
          <div className="text-muted">
            {loading
              ? "Loading sessions..."
              : `${sessions.length} class session${sessions.length === 1 ? "" : "s"} on ${formatLongDate(date)}.`}
          </div>
        </div>

        <div className="d-flex gap-2 align-items-center">
          <Form.Control
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ maxWidth: 200, borderRadius: 12 }}
          />
          <Button
            variant="outline-secondary"
            className="rounded-pill px-3"
            style={{ fontSize: 12 }}
            onClick={() => loadSessions(date)}
            disabled={loading}
          >
            Refresh
          </Button>
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
          <div className="mb-4 d-flex flex-wrap gap-2">
            {sessions.map((session) => {
              const active = String(selectedSession?.id) === String(session.id);
              return (
                <Button
                  key={session.id}
                  variant={active ? "primary" : "outline-secondary"}
                  className="rounded-pill px-3"
                  style={{ fontSize: 12 }}
                  onClick={() => setSelectedSessionId(session.id)}
                >
                  {sessionDisplayTitle(session)}
                </Button>
              );
            })}
          </div>

          {selectedSession ? (
            <>
              <SessionSummaryCard session={selectedSession} />

              <Row className="g-3">
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
                  />
              </Row>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}