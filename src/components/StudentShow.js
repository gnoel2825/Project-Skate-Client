// src/components/StudentShow.js
import React, { Component } from "react";
import api from "../api";
import { useParams, useNavigate, Link } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import Badge from "react-bootstrap/Badge";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const API_BASE = process.env.REACT_APP_API_BASE_URL;


function withRouter(Component) {
  return (props) => {
    const params = useParams();
    const navigate = useNavigate();
    return <Component {...props} params={params} navigate={navigate} />;
  };
}

// --- helpers ---
const isYmd = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

const formatBirthday = (yyyyMmDd) => {
  if (!yyyyMmDd || !isYmd(yyyyMmDd)) return yyyyMmDd || "";
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return yyyyMmDd;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(dt);
};

const fullName = (u) => {
  if (!u) return "";
  const first = u.first_name || u.firstName || "";
  const last = u.last_name || u.lastName || "";
  const combined = `${first} ${last}`.trim();
  return combined || u.name || u.email || "Person";
};

const weekdayLabel = (n) => {
  // 0=Sun ... 6=Sat
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return Number.isInteger(n) && n >= 0 && n <= 6 ? names[n] : "";
};

const weekdayFrom = (value) => {
  // Prefer explicit weekday if backend sends it
  if (Number.isInteger(value) && value >= 0 && value <= 6) return value;

  // Otherwise derive from starts_at ISO string
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
};

const formatTimeValue = (v) => {
  if (!v) return "";

  // "HH:MM" or "HH:MM:SS"
  if (typeof v === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(v)) {
    const [hh, mm] = v.split(":").map(Number);
    const dt = new Date(2000, 0, 1, hh, mm || 0, 0);
    return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // ISO datetime string
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatTimeRangeValue = (start, end) => {
  const s = formatTimeValue(start);
  const e = formatTimeValue(end);
  if (!s && !e) return "";
  if (s && !e) return s;
  if (!s && e) return e;
  return `${s} – ${e}`;
};

const initialsFor = (u) => {
  if (!u) return "??";
  const first = (u.first_name || u.firstName || "").trim();
  const last = (u.last_name || u.lastName || "").trim();

  const f = first ? first[0] : "";
  const l = last ? last[0] : "";

  if (f || l) return `${f}${l}`.toUpperCase();

  const nm = (u.name || "").trim();
  if (nm) {
    const parts = nm.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || "";
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
    return `${a}${b}`.toUpperCase() || "??";
  }

  const em = (u.email || "").trim();
  if (em) return em.slice(0, 2).toUpperCase();

  return "??";
};

const teacherDisplayName = (t) => {
  if (!t) return "Teacher";
  const first = (t.first_name || t.firstName || "").trim();
  const last = (t.last_name || t.lastName || "").trim();
  const nm = `${first} ${last}`.replace(/\s+/g, " ").trim();
  return nm || t.name || "Teacher";
};

const rosterPrimaryTeacher = (r) => {
  // prefer r.teacher, else first in r.teachers
  if (r?.teacher && typeof r.teacher === "object") return r.teacher;
  const arr = Array.isArray(r?.teachers) ? r.teachers : [];
  return arr.length ? arr[0] : null;
};

const hashHue = (seed) => {
  const str = String(seed || "");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
};

const Avatar = ({ initials, size = 34, seed }) => {
  const s = Number(size) || 34;
  const hue = hashHue(seed || initials || "??");

  // Soft pastel background, readable text
  const bg = `hsl(${hue} 70% 92%)`;
  const border = `hsl(${hue} 55% 80%)`;
  const text = `hsl(${hue} 40% 25%)`;

  return (
    <div
      aria-hidden="true"
      className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0"
      style={{
        width: s,
        height: s,
        fontSize: Math.max(12, Math.floor(s * 0.38)),
        fontWeight: 800,
        letterSpacing: 0.5,
        background: bg,
        border: `1px solid ${border}`,
        color: text
      }}
    >
      {initials}
    </div>
  );
};


const rosterScheduleLines = (r) => {
  const schedules = Array.isArray(r?.roster_schedules) ? r.roster_schedules : [];
  if (schedules.length === 0) return [];

  return schedules
    .slice()
    .map((sch) => {
      const wd = Number.isInteger(sch.weekday) ? sch.weekday : weekdayFrom(sch.starts_at);
      const day = wd == null ? "" : weekdayLabel(wd);
      const time = formatTimeRangeValue(sch.starts_at, sch.ends_at);
      const where = sch.location ? ` • ${sch.location}` : "";

      const left = [day, time].filter(Boolean).join(" • ");
      return `${left}${where}`.trim();
    })
    .filter(Boolean);
};

const rosterTeachers = (r) => {
  const arr = Array.isArray(r?.teachers) ? r.teachers : [];
  const fallback = r?.teacher && typeof r.teacher === "object" ? [r.teacher] : [];
  const raw = arr.length ? arr : fallback;

  const seen = new Set();
  const out = [];
  for (const t of raw) {
    if (!t) continue;
    const key =
      t.id != null ? `id:${t.id}` : t.email ? `email:${t.email}` : `name:${fullName(t)}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
};

class StudentShow extends Component {
  state = {
    student: null,

    loading: true,
    saving: false,
    deleting: false,

    error: null,
    success: null,

    isEditing: false,
    first_name: "",
    last_name: "",
    email: "",
    birthday: "",
    notes: ""
  };

  componentDidMount() {
    this.loadStudent();
  }

  loadStudent = () => {
    const { id } = this.props.params;

    this.setState({ loading: true, error: null, success: null });

    api
      .get(`/students/${id}`, { withCredentials: true })
      .then((res) => {
        const s = res.data;
        this.setState({
          student: s,
          first_name: s.first_name || "",
          last_name: s.last_name || "",
          email: s.email || "",
          birthday: s.birthday || "",
          notes: s.notes || "",
          loading: false
        });
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to load student";
        this.setState({ error: msg, loading: false });
      });
  };

  startEdit = () => this.setState({ isEditing: true, success: null, error: null });

  cancelEdit = () => {
    const s = this.state.student;
    this.setState({
      isEditing: false,
      first_name: s?.first_name || "",
      last_name: s?.last_name || "",
      email: s?.email || "",
      birthday: s?.birthday || "",
      notes: s?.notes || "",
      success: null,
      error: null
    });
  };

  handleChange = (e) => this.setState({ [e.target.name]: e.target.value });

  saveStudent = () => {
    const { id } = this.props.params;
    const { first_name, last_name, email, birthday, notes } = this.state;

    this.setState({ saving: true, error: null, success: null });

    api
      .patch(
        `/students/${id}`,
        {
          student: {
            first_name: (first_name || "").trim(),
            last_name: (last_name || "").trim(),
            email: (email || "").trim(),
            birthday: (birthday || "").trim() || null,
            notes: (notes || "").trim() || null
          }
        },
        { withCredentials: true }
      )
      .then((res) => {
        this.setState({
          student: res.data,
          isEditing: false,
          saving: false,
          success: "Student updated!"
        });
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to update student";
        this.setState({ error: msg, saving: false });
      });
  };

  deleteStudent = () => {
    const { id } = this.props.params;
    if (!window.confirm("Delete this student? This cannot be undone.")) return;

    this.setState({ deleting: true, error: null, success: null });

    api
      .delete(`/students/${id}`, { withCredentials: true })
      .then(() => this.props.navigate("/students"))
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to delete student";
        this.setState({ error: msg, deleting: false });
      });
  };

  render() {
    const {
      student,
      loading,
      saving,
      deleting,
      error,
      success,
      isEditing,
      first_name,
      last_name,
      email,
      birthday,
      notes
    } = this.state;

    if (loading) return <p className="m-4">Loading student…</p>;
    if (!student) return <Alert variant="danger" className="m-4">Student not found.</Alert>;

    const rosters = Array.isArray(student.rosters) ? student.rosters : [];
    const hasBirthday = !!student.birthday;
    const hasNotes = !!(student.notes && String(student.notes).trim().length > 0);
    const studentInitials = initialsFor(student);

    // Build teacher -> classes mapping
    const teacherMap = new Map(); // key -> { teacher, rosters: [] }

    for (const r of rosters) {
      const ts = rosterTeachers(r);
      for (const t of ts) {
        const key =
          t.id != null ? `id:${t.id}` :
          t.email ? `email:${t.email}` :
          `name:${fullName(t)}`;

        if (!teacherMap.has(key)) {
          teacherMap.set(key, { teacher: t, rosters: [] });
        }
        teacherMap.get(key).rosters.push(r);
      }
    }

    const teacherGroups = Array.from(teacherMap.values()).map((g) => {
      // Dedupe rosters under each teacher (in case backend repeats)
      const seenRoster = new Set();
      const uniqueRosters = [];
      for (const r of g.rosters) {
        const rk = r?.id != null ? `id:${r.id}` : `name:${r?.name || ""}`;
        if (!seenRoster.has(rk)) {
          seenRoster.add(rk);
          uniqueRosters.push(r);
        }
      }
      uniqueRosters.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      return { teacher: g.teacher, rosters: uniqueRosters };
    });

    // Sort teachers by last name / first name
    teacherGroups.sort((a, b) => {
      const al = (a.teacher.last_name || "").toLowerCase();
      const bl = (b.teacher.last_name || "").toLowerCase();
      if (al !== bl) return al.localeCompare(bl);
      const af = (a.teacher.first_name || "").toLowerCase();
      const bf = (b.teacher.first_name || "").toLowerCase();
      return af.localeCompare(bf);
    });

    return (
      <div className="container mt-4" style={{ maxWidth: 1000 }}>
        {/* Header */}
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-stretch align-items-sm-start gap-3 mb-3">
          <div style={{ minWidth: 0 }} className="d-flex gap-3 align-items-start">
            <Avatar initials={studentInitials} size={44} />

            <div style={{ minWidth: 0 }}>
              <h1 className="mb-1" style={{ wordBreak: "break-word" }}>
                {student.first_name || "Student"} {student.last_name || ""}
              </h1>
              <div className="text-muted" style={{ wordBreak: "break-word" }}>
                {student.email || "No email"}
              </div>
            </div>
          </div>

          <div className="d-flex flex-column flex-sm-row gap-2">
            {!isEditing ? (
              <Button variant="outline-primary" onClick={this.startEdit} className="w-100 w-sm-auto">
                Edit
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  onClick={this.saveStudent}
                  disabled={saving}
                  className="w-100 w-sm-auto"
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={this.cancelEdit}
                  disabled={saving}
                  className="w-100 w-sm-auto"
                >
                  Cancel
                </Button>
              </>
            )}

            <Button
              variant="outline-danger"
              onClick={this.deleteStudent}
              disabled={deleting}
              className="w-100 w-sm-auto"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>

        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        <Row className="g-3">
          <Col xs={12} md={6}>
            <Card>
              <Card.Body>
                <Card.Title className="mb-3">Details</Card.Title>

                {!isEditing ? (
                  <>
                    <div className="mb-2">
                      <div className="text-muted" style={{ fontSize: 12 }}>First name</div>
                      <div style={{ wordBreak: "break-word" }}>{student.first_name || "—"}</div>
                    </div>

                    <div className="mb-2">
                      <div className="text-muted" style={{ fontSize: 12 }}>Last name</div>
                      <div style={{ wordBreak: "break-word" }}>{student.last_name || "—"}</div>
                    </div>

                    <div className="mb-2">
                      <div className="text-muted" style={{ fontSize: 12 }}>Email</div>
                      <div style={{ wordBreak: "break-word" }}>{student.email || "—"}</div>
                    </div>

                    {hasBirthday ? (
                      <div className="mb-2">
                        <div className="text-muted" style={{ fontSize: 12 }}>Birthday</div>
                        <div style={{ wordBreak: "break-word" }}>
                          {formatBirthday(student.birthday)}
                        </div>
                      </div>
                    ) : null}

                    {hasNotes ? (
                      <div className="mb-2">
                        <div className="text-muted" style={{ fontSize: 12 }}>Notes</div>
                        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {student.notes}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label>First name</Form.Label>
                      <Form.Control
                        name="first_name"
                        value={first_name}
                        onChange={this.handleChange}
                        disabled={saving}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Last name</Form.Label>
                      <Form.Control
                        name="last_name"
                        value={last_name}
                        onChange={this.handleChange}
                        disabled={saving}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        name="email"
                        value={email}
                        onChange={this.handleChange}
                        disabled={saving}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Birthday</Form.Label>
                      <Form.Control
                        type="date"
                        name="birthday"
                        value={birthday || ""}
                        onChange={this.handleChange}
                        disabled={saving}
                      />
                      <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                        Optional — leave blank if unknown.
                      </div>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Notes</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        name="notes"
                        value={notes || ""}
                        onChange={this.handleChange}
                        disabled={saving}
                        placeholder="Any coaching notes, preferences, injuries, etc…"
                      />
                    </Form.Group>

                    <div className="d-flex flex-column flex-sm-row gap-2">
                      <Button
                        variant="primary"
                        onClick={this.saveStudent}
                        disabled={saving}
                        className="w-100 w-sm-auto"
                      >
                        {saving ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={this.cancelEdit}
                        disabled={saving}
                        className="w-100 w-sm-auto"
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* ✅ Classes (each card shows teacher avatar + name only) */}
<Col xs={12} md={6}>
  <Card className="mb-3">
    <Card.Body>
      <Card.Title className="d-flex justify-content-between align-items-center">
        <span>Classes</span>
        <Badge bg="secondary">{rosters.length}</Badge>
      </Card.Title>

      {rosters.length === 0 ? (
        <p className="text-muted mb-0 mt-2">No classes found for this student yet.</p>
      ) : (
        <div className="d-grid mt-3" style={{ gap: 12 }}>
          {rosters.map((r, idx) => {
            const t = rosterPrimaryTeacher(r);
            const scheduleLines = rosterScheduleLines(r);

            return (
              <Card
                key={r.id ?? `${r.name}-${idx}`}
                className="border"
                style={{ borderRadius: 14 }}
              >
                <Card.Body style={{ padding: 12 }}>
                  {/* Top row: class name + open */}
                  <div className="d-flex justify-content-between align-items-start gap-3">
                    <div style={{ minWidth: 0 }}>
                      <div className="fw-semibold" style={{ wordBreak: "break-word" }}>
                        {r.name || "Class"}
                      </div>

                      {/* Schedule lines (same as before) */}
                      {scheduleLines.length > 0 ? (
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {scheduleLines.map((line, i) => (
                            <div key={`${r.id ?? idx}-sch-${i}`}>{line}</div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {r.id ? (
                      <Link
                        to={`/rosters/${r.id}`}
                        className="btn btn-outline-primary btn-sm"
                      >
                        Open
                      </Link>
                    ) : null}
                  </div>

                  {/* Teachers row: multiple teachers, avatar + name only */}
<div className="d-flex flex-wrap gap-2 mt-3">
  {rosterTeachers(r).length === 0 ? (
    <div className="text-muted" style={{ fontSize: 12 }}>No teachers assigned.</div>
  ) : (
    rosterTeachers(r).map((tch, i) => {
      const name = teacherDisplayName(tch);
      const key = tch?.id ?? tch?.email ?? `${name}-${i}`;
      const seed = tch?.id ?? tch?.email ?? name;

      return (
        <div
          key={key}
          className="d-inline-flex align-items-center gap-2"
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #e9ecef",
            background: "#fff"
          }}
        >
          <Avatar initials={initialsFor(tch)} size={26} seed={seed} />

          {tch?.id ? (
            <Link
              to={`/teachers/${tch.id}`}
              className="text-decoration-none"
              style={{ fontWeight: 600, color: "inherit", fontSize: 13 }}
            >
              {name}
            </Link>
          ) : (
            <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
          )}
        </div>
      );
    })
  )}
</div>

                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}
    </Card.Body>
  </Card>
</Col>
        </Row>

        <div className="mt-3">
          <Link to="/students" className="btn btn-link px-0">
            ← Back to students
          </Link>
        </div>
      </div>
    );
  }
}

export default withRouter(StudentShow);
