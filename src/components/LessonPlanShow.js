// src/components/LessonPlanShow.js
import React, { Component } from "react";
import api from "../api";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const API_BASE = process.env.REACT_APP_API_BASE_URL;


function withParams(Component) {
  return (props) => {
    const params = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const rosterId = searchParams.get("roster_id"); // ✅

    return <Component {...props} params={params} navigate={navigate} rosterId={rosterId} />;
  };
}
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// turn "HH:MM" or ISO-ish into compact time like "5:00p"
function compactTime(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [hh, mm] = value.split(":").map(Number);
    const dt = new Date(2000, 0, 1, hh, mm || 0, 0);
    return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      .replace(":00", "")
      .replace(" AM", "a")
      .replace(" PM", "p")
      .replace(" am", "a")
      .replace(" pm", "p");
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
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

function localWeekdayFromYmd(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const [y, m, d] = String(yyyyMmDd).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getDay(); // 0..6 local
}

function timeToMinutes(value) {
  if (!value) return null;

  // "HH:MM" or "HH:MM:SS"
  if (typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [hh, mm] = value.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh * 60 + mm;
  }

  // ISO datetime string (or Date-ish)
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  // IMPORTANT: use LOCAL hours/minutes (same behavior as toLocaleTimeString)
  return d.getHours() * 60 + d.getMinutes();
}


function approxEqualMinutes(a, b, tolerance = 2) {
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tolerance;
}


const SectionKicker = ({ children, className = "", style = {} }) => (
  <div
    className={`text-uppercase text-muted ${className}`}
    style={{ fontSize: 11, letterSpacing: 0.6, ...style }}
  >
    {children}
  </div>
);

// safe “array extraction” helper (handles {rosters:[...]} etc.)
function coerceArray(resData) {
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData?.rosters)) return resData.rosters;
  if (Array.isArray(resData?.data)) return resData.data;
  if (Array.isArray(resData?.items)) return resData.items;
  return [];
}

const formatDate = (yyyyMmDd) => {
  if (!yyyyMmDd) return "";
  // Parse as local date (avoid timezone shifting)
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dt);
};

const formatDateShort = (yyyyMmDd) => {
  if (!yyyyMmDd) return "";
  const [y, m, d] = String(yyyyMmDd).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(dt);
};


function formatTime(value) {
  if (!value) return "";

  // "HH:MM" or "HH:MM:SS"
  if (typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [hh, mm] = value.split(":").map(Number);
    const dt = new Date(2000, 0, 1, hh, mm || 0, 0);
    return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // ISO datetime string
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTimeRange(startValue, endValue) {
  const start = formatTime(startValue);
  const end = formatTime(endValue);
  if (!start && !end) return "";
  if (start && !end) return start;
  if (!start && end) return end;
  return `${start} – ${end}`;
}

class LessonPlanShow extends Component {
  state = {
    lessonPlan: null,
    skills: [],

    selectedSkillIdsByRole: {
      main: new Set(),
      warmup: new Set(),
      cooldown: new Set(),
    },
    activeRole: "main",

    // editing plan fields
    isEditing: false,
    title: "",
    description: "",
    warmupNotes: "",
    mainNotes: "",
    cooldownNotes: "",

    loading: true,
    saving: false,
    error: null,
    success: null,

    // scheduling form
    newTaughtOn: "",
    newStartsAt: "",
    newEndsAt: "",
    newLocation: "",
    editingNotesRole: null, 

    weeklyOverview: {}, // { [weekdayNumber]: [{ roster, schedule }] }
weeklyOverviewLoading: false,
weeklyOverviewError: null,
  };

  componentDidMount() {
    this.loadPage();
    this.loadWeeklyOverview();
  }

  loadPage = () => {
    const { id } = this.props.params;
    const { rosterId } = this.props;

    const lpParams = rosterId ? { roster_id: rosterId } : undefined;

    this.setState({ loading: true, error: null, success: null });

    Promise.all([
      api.get(`/lesson_plans/${id}`, {
        withCredentials: true,
        params: lpParams,
      }),
      api.get(`/skills`, { withCredentials: true }),
    ])
      .then(([lpRes, skillsRes]) => {
        const lp = lpRes.data;

        this.setState({
          lessonPlan: lp,
          skills: skillsRes.data || [],

          title: lp.title || "",
          description: lp.description || "",
          warmupNotes: lp.warmup_notes || "",
          mainNotes: lp.main_notes || "",
          cooldownNotes: lp.cooldown_notes || "",

          loading: false,
          saving: false,
        });
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to load lesson plan";

        this.setState({ error: msg, loading: false, saving: false });
      });
  };

  startEdit = () =>
  this.setState({
    isEditing: true,
    editingNotesRole: this.state.editingNotesRole || "main",
    activeRole: this.state.activeRole || "main",
    success: null,
    error: null
  });

startEditNotes = (roleKey) =>
  this.setState({
    isEditing: true,
    editingNotesRole: roleKey,
    activeRole: roleKey, // keeps Add Skills role in sync
    success: null,
    error: null
  });

setEditingNotesRole = (roleKey) =>
  this.setState({
    editingNotesRole: roleKey,
    activeRole: roleKey
  });

cancelEdit = () => {
  const lp = this.state.lessonPlan;
  this.setState({
    isEditing: false,
    editingNotesRole: null, // ✅ reset
    title: lp?.title || "",
    description: lp?.description || "",
    warmupNotes: lp?.warmup_notes || "",
    mainNotes: lp?.main_notes || "",
    cooldownNotes: lp?.cooldown_notes || "",
    success: null,
    error: null
  });
};

  handleFieldChange = (e) => this.setState({ [e.target.name]: e.target.value });

  saveLessonPlan = () => {
  const { id } = this.props.params;
  const { title, description, warmupNotes, mainNotes, cooldownNotes } = this.state;

  const payload = {
    lesson_plan: {
      title: (title || "").trim(),
      description: (description || "").trim(),
      warmup_notes: (warmupNotes ?? "").trim() || null,
      main_notes: (mainNotes ?? "").trim() || null,
      cooldown_notes: (cooldownNotes ?? "").trim() || null
    }
  };

  this.setState({ saving: true, error: null, success: null });

  api
    .patch(`/lesson_plans/${id}`, payload, { withCredentials: true })
    .then((res) => {
      // ✅ support both shapes:
      //   render json: lesson_plan
      //   render json: { lesson_plan: lesson_plan }
      const updated = res.data?.lesson_plan ?? res.data;

      this.setState((prev) => ({
        lessonPlan: { ...prev.lessonPlan, ...updated },
        // ✅ keep local edit fields synced with persisted values
        warmupNotes: updated?.warmup_notes ?? prev.warmupNotes,
        mainNotes: updated?.main_notes ?? prev.mainNotes,
        cooldownNotes: updated?.cooldown_notes ?? prev.cooldownNotes,
        isEditing: false,
        editingNotesRole: null,
        saving: false,
        success: "Lesson plan updated!"
      }));

      // Optional: leave this OFF while debugging saving.
      // If backend isn't persisting notes, this reload will "erase" them again.
      // this.loadPage();
    })
    .catch((err) => {
      const msg =
        err.response?.data?.errors?.join(", ") ||
        err.response?.data?.error ||
        err.message ||
        "Failed to update lesson plan";
      this.setState({ error: msg, saving: false });
    });
};

  removeSkill = (role, skillId) => {
    const { id } = this.props.params;

    this.setState({ saving: true, error: null, success: null });

    api
      .delete(`/lesson_plans/${id}/remove_skill/${skillId}`, {
        withCredentials: true,
        params: { role },
      })
      .then(() => this.loadPage())
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") || err.message || "Failed to remove skill";
        this.setState({ error: msg, saving: false });
      });
  };

  toggleAddSkill = (role, skillId) => {
    this.setState((prev) => {
      const next = { ...prev.selectedSkillIdsByRole };
      const setCopy = new Set(next[role]);
      if (setCopy.has(skillId)) setCopy.delete(skillId);
      else setCopy.add(skillId);
      next[role] = setCopy;
      return { selectedSkillIdsByRole: next };
    });
  };

  addSelectedSkills = (role) => {
    const { id } = this.props.params;
    const skillIds = Array.from(this.state.selectedSkillIdsByRole[role] || []);
    if (skillIds.length === 0) return;

    this.setState({ saving: true, error: null, success: null });

    api
      .post(
        `/lesson_plans/${id}/add_skills`,
        { skill_ids: skillIds, role },
        { withCredentials: true }
      )
      .then(() => {
        this.setState((prev) => ({
          selectedSkillIdsByRole: { ...prev.selectedSkillIdsByRole, [role]: new Set() },
        }));
        return this.loadPage();
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") || err.message || "Failed to add skills";
        this.setState({ error: msg, saving: false });
      });
  };

  handleOccFieldChange = (e) => {
    this.setState({ [e.target.name]: e.target.value });
  };

  createOccurrence = (e) => {
    e.preventDefault();

    const { id } = this.props.params;
    const { newTaughtOn, newStartsAt, newEndsAt, newLocation } = this.state;

    this.setState({ saving: true, error: null, success: null });

    api
      .post(
        `/lesson_plans/${id}/lesson_plan_occurrences`,
        {
          lesson_plan_occurrence: {
            taught_on: newTaughtOn,
            starts_at: newStartsAt || null,
            ends_at: newEndsAt || null,
            location: newLocation.trim() || null,
          },
        },
        { withCredentials: true }
      )
      .then(() => {
        this.setState({
          newTaughtOn: "",
          newStartsAt: "",
          newEndsAt: "",
          newLocation: "",
          success: "Scheduled date added!",
          saving: false,
        });
        return this.loadPage();
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") || err.message || "Failed to schedule date";
        this.setState({ error: msg, saving: false });
      });
  };

  deleteOccurrence = (occurrenceId) => {
    const { id } = this.props.params;
    if (!window.confirm("Remove this scheduled date?")) return;

    this.setState({ saving: true, error: null, success: null });

    api
      .delete(`/lesson_plans/${id}/lesson_plan_occurrences/${occurrenceId}`, {
        withCredentials: true,
      })
      .then(() => {
        this.setState({
          saving: false,
          success: "Scheduled date removed.",
        });
        this.loadPage();
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") || err.message || "Failed to remove scheduled date";
        this.setState({ error: msg, saving: false });
      });
  };

  deleteLessonPlan = () => {
    const { id } = this.props.params;

    if (!window.confirm("Delete this lesson plan? This cannot be undone.")) return;

    this.setState({ saving: true, error: null });

    api
      .delete(`/lesson_plans/${id}`, { withCredentials: true })
      .then(() => {
        this.props.navigate("/lesson-plans");
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to delete lesson plan";

        this.setState({ error: msg, saving: false });
      });
  };

  renderNotesDisplay = (roleKey, label) => {
  const { lessonPlan, isEditing, editingNotesRole } = this.state;

  const value =
    roleKey === "warmup"
      ? isEditing
        ? this.state.warmupNotes
        : lessonPlan?.warmup_notes
      : roleKey === "cooldown"
      ? isEditing
        ? this.state.cooldownNotes
        : lessonPlan?.cooldown_notes
      : isEditing
      ? this.state.mainNotes
      : lessonPlan?.main_notes;

  // If we're currently editing THIS role, don't show the display block
  if (isEditing && (editingNotesRole || "main") === roleKey) return null;

  const hasNotes = Boolean((value || "").trim());

  return (
    <div className="mt-3">
      {/* sleeker label */}
      <div className="d-flex align-items-center gap-2 mb-2">
        <div className="text-uppercase text-muted" style={{ fontSize: 11, letterSpacing: 0.6 }}>
          Notes
        </div>
        <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
      </div>

      {hasNotes ? (
        <div
          className="border rounded-3 p-2"
          style={{
            background: "#fcfcff",
            borderColor: "#e9ecef"
          }}
        >
          <div className="d-flex align-items-start gap-2">
            <div
              aria-hidden="true"
              className="rounded-2"
              style={{
                width: 10,
                height: 10,
                marginTop: 5,
                background: "#dee2e6",
                flex: "0 0 auto"
              }}
            />
            <div style={{ fontSize: 14, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>
              {value}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};


  renderNotesBlock = (roleKey, label) => {
  const { isEditing, saving, lessonPlan, editingNotesRole } = this.state;

  // Only show editor in edit mode, and only for the currently selected notes section
  if (!isEditing) return null;
  if ((editingNotesRole || "main") !== roleKey) return null;

  const value =
    roleKey === "warmup"
      ? this.state.warmupNotes
      : roleKey === "cooldown"
      ? this.state.cooldownNotes
      : this.state.mainNotes;

  const name =
    roleKey === "warmup" ? "warmupNotes" : roleKey === "cooldown" ? "cooldownNotes" : "mainNotes";

  return (
    <Form.Group className="mt-3">
      <div className="d-flex align-items-center gap-2 mb-2">
        <div className="text-uppercase text-muted" style={{ fontSize: 11, letterSpacing: 0.6 }}>
          Notes (editing)
        </div>
        <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
      </div>

      <Form.Control
        as="textarea"
        rows={4}
        name={name}
        value={value || ""}
        onChange={this.handleFieldChange}
        disabled={saving}
        placeholder={`Add notes for ${label.toLowerCase()}…`}
        style={{ borderRadius: 12 }}
      />
      <div className="form-text">
        Tip: keep this to cues, reminders, and custom skills you’re teaching.
      </div>
    </Form.Group>
  );
};

getMatchingWeeklyRostersForOccurrence = (occ) => {
  const wd = localWeekdayFromYmd(occ?.taught_on);
  if (wd == null) return [];

  const occStart = timeToMinutes(occ?.starts_at);
  const occEnd = timeToMinutes(occ?.ends_at);

  const dayRows = (this.state.weeklyOverview || {})[wd] || [];
  if (!dayRows.length) return [];

  // If the occurrence has no time, can't match to a roster block
  if (occStart == null && occEnd == null) return [];

  const matches = dayRows.filter(({ schedule }) => {
    const sStart = timeToMinutes(schedule?.starts_at);
    const sEnd = timeToMinutes(schedule?.ends_at);

    // If we have full ranges on both sides:
    if (occStart != null && occEnd != null && sStart != null && sEnd != null) {
      const exact =
        approxEqualMinutes(occStart, sStart, 3) &&
        approxEqualMinutes(occEnd, sEnd, 3);

      // overlap (occurrence inside roster block or vice versa)
      // add a tiny buffer so 5:00-6:00 matches 4:59-6:01 etc
      const buffer = 2;
      const occA = occStart - buffer;
      const occB = occEnd + buffer;
      const schA = sStart - buffer;
      const schB = sEnd + buffer;

      const overlaps = occA < schB && occB > schA;

      return exact || overlaps;
    }

    // Otherwise: match by start time only (looser)
    if (occStart != null && sStart != null) {
      return approxEqualMinutes(occStart, sStart, 5);
    }

    return false;
  });

  // unique rosters
  const byId = new Map();
  matches.forEach(({ roster }) => {
    if (roster?.id != null) byId.set(String(roster.id), roster);
  });

  return Array.from(byId.values());
};



loadWeeklyOverview = async () => {
  this.setState({ weeklyOverviewLoading: true, weeklyOverviewError: null });

  try {
    // 1) get rosters list (try a couple common endpoints)
    let rostersRes = null;

    try {
      rostersRes = await api.get(`/rosters`, { withCredentials: true });
    } catch (e1) {
      // fallback if your app uses a different route name
      rostersRes = await api.get(`/rosters/all`, { withCredentials: true });
    }

    const rosters = coerceArray(rostersRes.data);

    // 2) fetch weekly schedules for each roster
    const scheduleRequests = (rosters || [])
      .filter((r) => r?.id != null)
      .map((r) =>
        api
          .get(`/rosters/${r.id}/roster_schedules`, { withCredentials: true })
          .then((res) => ({ roster: r, schedules: coerceArray(res.data) }))
          .catch(() => ({ roster: r, schedules: [] }))
      );

    const results = await Promise.all(scheduleRequests);

    // 3) build grouped view by weekday
    const grouped = {}; // weekday -> rows

    results.forEach(({ roster, schedules }) => {
      (schedules || []).forEach((sch) => {
        const wd = Number(sch.weekday);
        if (Number.isNaN(wd)) return;
        grouped[wd] = grouped[wd] || [];
        grouped[wd].push({ roster, schedule: sch });
      });
    });

    // 4) sort within each weekday by start time then roster name
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



  render() {
    const {
      lessonPlan,
      skills,
      selectedSkillIdsByRole,
      activeRole,
      isEditing,
      title,
      description,
      loading,
      saving,
      error,
      success,
    } = this.state;

    if (loading) return <p className="m-4">Loading lesson plan…</p>;

    if (error && !lessonPlan) {
      return (
        <Alert variant="danger" className="m-4">
          {error}
        </Alert>
      );
    }

    const mainSkills = lessonPlan?.main_skills || lessonPlan?.skills || [];
    const warmupSkills = lessonPlan?.warmup_skills || [];
    const cooldownSkills = lessonPlan?.cooldown_skills || [];
    const occurrences = lessonPlan?.lesson_plan_occurrences || [];

    const role = activeRole;
    const selectedSet = selectedSkillIdsByRole?.[role] || new Set();

    const roleSkills =
      role === "main" ? mainSkills : role === "warmup" ? warmupSkills : cooldownSkills;

    const roleSkillIds = new Set(roleSkills.map((s) => s.id));
    const availableSkills = (skills || []).filter((s) => !roleSkillIds.has(s.id));

    const availableByLevel = availableSkills.reduce((acc, s) => {
      const lvl = s.level ?? 0;
      acc[lvl] = acc[lvl] || [];
      acc[lvl].push(s);
      return acc;
    }, {});

    const levels = Object.keys(availableByLevel)
      .map(Number)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    const roleLabel =
      activeRole === "warmup" ? "Warm-up" : activeRole === "cooldown" ? "Cool-down" : "Main";

    return (
      <div className="container mt-4" style={{ maxWidth: 1000 }}>
        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Header / Details */}
        <Card className="mb-4">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
              <div style={{ flex: 1, minWidth: 260 }}>
                {!isEditing ? (
                  <>
                    <Card.Title className="mb-1">{lessonPlan.title}</Card.Title>
                    {lessonPlan.description ? (
                      <Card.Text className="text-muted">{lessonPlan.description}</Card.Text>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Form.Group className="mb-2">
                      <Form.Label>Title</Form.Label>
                      <Form.Control
                        name="title"
                        value={title}
                        onChange={this.handleFieldChange}
                        disabled={saving}
                      />
                    </Form.Group>

                    <Form.Group className="mb-2">
                      <Form.Label>Description</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        name="description"
                        value={description}
                        onChange={this.handleFieldChange}
                        disabled={saving}
                      />
                    </Form.Group>
                  </>
                )}
              </div>

              <div className="d-flex gap-2 flex-wrap">
                {!isEditing ? (
                  <>
                    <Button size="sm"
                            className="rounded-pill px-3"
                            variant="primary"
                            style={{ fontSize: 12 }} onClick={this.startEdit}>
                      Edit
                    </Button>
                    <Button size="sm"
                            className="rounded-pill px-3"
                            variant="danger"
                            style={{ fontSize: 12 }} onClick={this.deleteLessonPlan} disabled={saving}>
                      Delete
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="primary" onClick={this.saveLessonPlan} disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline-secondary"
                      onClick={this.cancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button variant="outline-danger" onClick={this.deleteLessonPlan} disabled={saving}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card.Body>
        </Card>

       <Row>
  {/* Skills (left) */}
  <Col md={isEditing ? 6 : 12} className="mb-4">
            <Card className="mb-3">
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-2">
  <SectionKicker>Warm-up</SectionKicker>
  <Badge bg="secondary">{warmupSkills.length}</Badge>
  <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />

  {isEditing ? (
    <Button
      size="sm"
      variant={(this.state.editingNotesRole || "main") === "warmup" ? "primary" : "outline-secondary"}
      onClick={() => this.setEditingNotesRole("warmup")}
      disabled={saving}
      className="rounded-pill px-3"
    >
      Edit notes
    </Button>
  ) : null}
</div>


                

                {warmupSkills.length === 0 ? (
                  <p className="text-muted mb-0 mt-3">No warm-up skills yet.</p>
                ) : (
                  <ul className="mt-3">
                    {warmupSkills
                      .slice()
                      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
                      .map((skill) => (
                        <li
                          key={skill.id}
                          className="mb-2 d-flex justify-content-between align-items-start gap-2"
                        >
                          <span>
                            <strong>Basic {skill.level}</strong> — {skill.name}
                          </span>
                          <Button
                            size="sm"
                            className="rounded-pill px-3"
                            variant="outline-danger"
                            style={{ fontSize: 12 }}
                            onClick={() => this.removeSkill("warmup", skill.id)}
                            disabled={saving}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                  </ul>
                )}
                {this.renderNotesDisplay("warmup", "Warm-up")}
                {this.renderNotesBlock("warmup", "Warm-up")}
              </Card.Body>
            </Card>

            <Card className="mb-3">
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-2">
  <SectionKicker>Main lesson</SectionKicker>
  <Badge bg="secondary">{mainSkills.length}</Badge>
  <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />

  {isEditing ? (
    <Button
      size="sm"
      variant={(this.state.editingNotesRole || "main") === "main" ? "primary" : "outline-secondary"}
      onClick={() => this.setEditingNotesRole("main")}
      disabled={saving}
      className="rounded-pill px-3"
    >
      Edit notes
    </Button>
  ) : null}
</div>


                

                {mainSkills.length === 0 ? (
                  <p className="text-muted mb-0 mt-3">No skills added yet.</p>
                ) : (
                  <ul className="mt-3">
                    {mainSkills
                      .slice()
                      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
                      .map((skill) => (
                        <li
                          key={skill.id}
                          className="mb-2 d-flex justify-content-between align-items-start gap-2"
                        >
                          <span>
                            <strong>Basic {skill.level}</strong> — {skill.name}
                          </span>
                          <Button
                            size="sm"
                            className="rounded-pill px-3"
                            variant="outline-danger"
                            style={{ fontSize: 12 }}
                            onClick={() => this.removeSkill("main", skill.id)}
                            disabled={saving}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                  </ul>
                )}
                {this.renderNotesDisplay("main", "Main lesson")}
                {this.renderNotesBlock("main", "Main lesson")}
              </Card.Body>
            </Card>

            <Card>
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-2">
  <SectionKicker>Cool-down</SectionKicker>
  <Badge bg="secondary">{cooldownSkills.length}</Badge>
  <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />

  {isEditing ? (
    <Button
      size="sm"
      variant={(this.state.editingNotesRole || "main") === "cooldown" ? "primary" : "outline-secondary"}
      onClick={() => this.setEditingNotesRole("cooldown")}
      disabled={saving}
      className="rounded-pill px-3"
    >
      Edit notes
    </Button>
  ) : null}
</div>



               

                {cooldownSkills.length === 0 ? (
                  <p className="text-muted mb-0 mt-3">No cool-down skills yet.</p>
                ) : (
                  <ul className="mt-3">
                    {cooldownSkills
                      .slice()
                      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
                      .map((skill) => (
                        <li
                          key={skill.id}
                          className="mb-2 d-flex justify-content-between align-items-start gap-2"
                        >
                          <span>
                            <strong>Basic {skill.level}</strong> — {skill.name}
                          </span>
                          <Button
                            size="sm"
                            className="rounded-pill px-3"
                            variant="outline-danger"
                            style={{ fontSize: 12 }}
                            onClick={() => this.removeSkill("cooldown", skill.id)}
                            disabled={saving}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                  </ul>
                )}
                {this.renderNotesDisplay("cooldown", "Cool-down")}
                {this.renderNotesBlock("cooldown", "Cool-down")}
              </Card.Body>
          
            </Card>
          </Col>

          {/* Add skills (right) — only in Edit mode */}
{isEditing ? (
  <Col md={6} className="mb-4">
    <Card>
      <Card.Body>
        <Card.Title className="d-flex justify-content-between align-items-center">
          <span>Add Skills</span>
          <Badge bg="secondary">{selectedSet.size} selected</Badge>
        </Card.Title>

        <div className="d-flex gap-2 mb-2 flex-wrap">
          {[
            { key: "main", label: "Main" },
            { key: "warmup", label: "Warm-up" },
            { key: "cooldown", label: "Cool-down" },
          ].map(({ key, label }) => (
            <Button
              key={key}
              size="sm"
              variant={activeRole === key ? "primary" : "outline-secondary"}
              onClick={() => this.setState({ activeRole: key })}
              disabled={saving}
            >
              Add to {label}
            </Button>
          ))}
        </div>

        {levels.length === 0 ? (
          <p className="text-muted mb-0 mt-3">No more skills available to add.</p>
        ) : (
          <div style={{ maxHeight: 420, overflowY: "auto" }} className="mt-3">
            {levels.map((lvl) => (
              <div key={lvl} className="mb-3">
                <div className="fw-semibold mb-2">Basic {lvl}</div>
                {availableByLevel[lvl].map((skill) => (
                  <Form.Check
                    key={skill.id}
                    type="checkbox"
                    id={`add-${activeRole}-skill-${skill.id}`}
                    label={skill.name}
                    checked={selectedSet.has(skill.id)}
                    onChange={() => this.toggleAddSkill(activeRole, skill.id)}
                    disabled={saving}
                    className="mb-2"
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="d-flex gap-2 mt-3 flex-wrap">
          <Button
            variant="primary"
            onClick={() => this.addSelectedSkills(activeRole)}
            disabled={saving || selectedSet.size === 0}
          >
            {saving ? "Saving..." : `Add selected to ${roleLabel}`}
          </Button>

          <Button
            variant="outline-secondary"
            onClick={() =>
              this.setState((prev) => ({
                selectedSkillIdsByRole: {
                  ...prev.selectedSkillIdsByRole,
                  [activeRole]: new Set(),
                },
              }))
            }
            disabled={saving || selectedSet.size === 0}
          >
            Clear
          </Button>
        </div>
      </Card.Body>
    </Card>
  </Col>
) : null}
        </Row>



      <Card className="mt-3" style={{ borderRadius: 14 }}>
  <Card.Body>
    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
  <Card.Title className="mb-0">Lesson Plan Scheduler</Card.Title>

  <div className="d-flex align-items-center gap-2">
    <div className="text-muted" style={{ fontSize: 13 }}>
      <Badge bg="secondary">{occurrences.length}</Badge> classes
    </div>
  </div>
</div>

{/* WEEKLY OVERVIEW GRID (compact reference) */}
<div className="mt-3">
  <div className="d-flex align-items-center gap-2 mb-2">
    <div className="text-uppercase text-muted" style={{ fontSize: 11, letterSpacing: 0.6 }}>
      MY WEEKLY SCHEDULE
    </div>
    <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
  </div>

  {this.state.weeklyOverviewError ? (
    <Alert variant="danger" className="mb-2">
      {this.state.weeklyOverviewError}
    </Alert>
  ) : null}

  {this.state.weeklyOverviewLoading ? (
    <div className="text-muted" style={{ fontSize: 13 }}>Loading weekly schedule…</div>
  ) : (
    <Row className="g-2">
      {Array.from({ length: 7 }).map((_, wd) => {
        const rows = (this.state.weeklyOverview || {})[wd] || [];

        return (
          <Col key={wd} xs={12} sm={6} md={3} lg>
            <div
              className="border rounded-3 p-2 h-100"
              style={{ background: "#fff" }}
            >
              <div className="d-flex justify-content-between align-items-center">
                <div
                  className="text-uppercase text-muted"
                  style={{ fontSize: 10, letterSpacing: 0.6 }}
                >
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
                      <div
                        key={`${roster?.id}-${schedule?.id}`}
                        className="d-flex align-items-start justify-content-between"
                        style={{ gap: 8 }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            className="fw-semibold"
                            style={{
                              fontSize: 12,
                              lineHeight: 1.15,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
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
                      </div>
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
      })}
    </Row>
  )}
</div>

<hr className="my-3" />


   {/* LESSON PLAN SCHEDULED DATES (NOT weekly schedule) */}
<div className="mt-3">
  <div className="d-flex align-items-center gap-2 mb-2">
    <SectionKicker>Lesson plan scheduled dates</SectionKicker>
    <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
    <Badge bg="light" text="dark">{occurrences.length}</Badge>
  </div>
  {occurrences.length === 0 ? (
    <p className="text-muted mb-0 mt-2">No dates scheduled yet.</p>
  ) : (
    <div className="d-grid mt-2" style={{ gap: 8 }}>
      {occurrences
        .slice()
        .sort((a, b) => (a.taught_on || "").localeCompare(b.taught_on || ""))
        .map((occ) => {
          const time = formatTimeRange(occ.starts_at, occ.ends_at);
          const rosters = this.getMatchingWeeklyRostersForOccurrence(occ);

          return (
  <div
    key={occ.id}
    className="border rounded-3 px-3 py-2 d-flex justify-content-between align-items-center"
    style={{
      gap: 12,
      background: "#fbfbfd",
      borderColor: "#e9ecef",
    }}
  >
    <div style={{ minWidth: 0 }}>
      <div className="d-flex flex-wrap align-items-center" style={{ gap: 10 }}>
        <Link
          to={`/calendar?date=${encodeURIComponent(occ.taught_on)}`}
          className="text-decoration-none fw-semibold"
          style={{ fontSize: 13 }}
        >
          {formatDateShort(occ.taught_on)}
        </Link>

        {/* time */}
        {time ? (
          <span className="text-muted" style={{ fontSize: 12 }}>
            {compactRange(occ.starts_at, occ.ends_at) || time}
          </span>
        ) : null}

        {/* roster match “chips” */}
        {rosters.length > 0 ? (
          <div className="d-flex flex-wrap align-items-center" style={{ gap: 6 }}>

            {rosters.slice(0, 2).map((r) => (
              <Link
                key={r.id}
                to={`/rosters/${r.id}`}
                className="text-decoration-none"
                title={r.name || "Roster"}
              >
                <Badge
                  bg="light"
                  text="dark"
                  className="border"
                  style={{
                    fontWeight: 600,
                    fontSize: 11,
                    padding: "6px 10px",
                    borderRadius: 999,
                  }}
                >
                  {r.name || "Roster"}
                </Badge>
              </Link>
            ))}

            {rosters.length > 2 ? (
              <span className="text-muted" style={{ fontSize: 12 }}>
                +{rosters.length - 2}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* location */}
      {occ.location ? (
        <div className="text-muted mt-1" style={{ fontSize: 12 }}>
          {occ.location}
        </div>
      ) : null}
    </div>

    <Button
      size="sm rounded-pill"
      variant="outline-danger"
      onClick={() => this.deleteOccurrence(occ.id)}
      disabled={saving}
      className="rounded-pill px-3"
      style={{ fontSize: 12 }}
    >
      Remove
    </Button>
  </div>
);

        })}
    </div>
  )}
</div>


    {/* DIVIDER */}
    <hr className="my-3" />

    <div className="d-flex align-items-center gap-2 mb-2">
  <SectionKicker>Add to schedule</SectionKicker>
  <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
</div>


    <Form onSubmit={this.createOccurrence}>
      <Row className="g-2 align-items-end">
        <Col md={4}>
          <Form.Label>Date</Form.Label>
          <Form.Control
            type="date"
            name="newTaughtOn"
            value={this.state.newTaughtOn}
            onChange={this.handleOccFieldChange}
            required
            disabled={saving}
          />
        </Col>

        <Col md={3}>
          <Form.Label>Start</Form.Label>
          <Form.Control
            type="time"
            name="newStartsAt"
            value={this.state.newStartsAt}
            onChange={this.handleOccFieldChange}
            disabled={saving}
          />
        </Col>

        <Col md={3}>
          <Form.Label>End</Form.Label>
          <Form.Control
            type="time"
            name="newEndsAt"
            value={this.state.newEndsAt}
            onChange={this.handleOccFieldChange}
            disabled={saving}
          />
        </Col>

        <Col md={10}>
          <Form.Label>Location (optional)</Form.Label>
          <Form.Control
            type="text"
            name="newLocation"
            placeholder="e.g. Rink A"
            value={this.state.newLocation}
            onChange={this.handleOccFieldChange}
            disabled={saving}
          />
        </Col>

        <Col md={2}>
          <Button type="submit" size="sm" className="w-100 rounded-pill" variant="primary" disabled={saving}>
            {saving ? "Saving..." : "Add"}
          </Button>
        </Col>
      </Row>

      <div className="mt-2 d-flex gap-2 flex-wrap">
        <Button
        size="sm"
          type="button"
          className="w-100 rounded-pill" variant="primary"
          disabled={saving}
          onClick={() =>
            this.setState({
              newTaughtOn: "",
              newStartsAt: "",
              newEndsAt: "",
              newLocation: ""
            })
          }
        >
          Clear
        </Button>
      </div>
    </Form>
  </Card.Body>
</Card>

      </div>
    );
  }
}

export default withParams(LessonPlanShow);
