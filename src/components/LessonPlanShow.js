import React, { Component } from "react";
import api from "../api";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import InputGroup from "react-bootstrap/InputGroup";

function withParams(Component) {
  return (props) => {
    const params = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const rosterId = searchParams.get("roster_id");
    return <Component {...props} params={params} navigate={navigate} rosterId={rosterId} />;
  };
}

const BTN_CLASS = "rounded-pill px-3";
const BTN_STYLE = { fontSize: 12 };

const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ROLE = {
  MAIN: "main",
  WARMUP: "warmup",
  COOLDOWN: "cooldown",
};

const SectionKicker = ({ children, className = "", style = {} }) => (
  <div
    className={`text-uppercase text-muted ${className}`}
    style={{ fontSize: 11, letterSpacing: 0.6, ...style }}
  >
    {children}
  </div>
);

function coerceArray(resData) {
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData?.rosters)) return resData.rosters;
  if (Array.isArray(resData?.data)) return resData.data;
  if (Array.isArray(resData?.items)) return resData.items;
  return [];
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

function localWeekdayFromYmd(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const [y, m, d] = String(yyyyMmDd).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getDay();
}

function timeToMinutes(value) {
  if (!value) return null;

  if (typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [hh, mm] = value.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh * 60 + mm;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function approxEqualMinutes(a, b, tolerance = 2) {
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tolerance;
}

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

const formatDateLong = (value) => {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(dt);
};

function formatTime(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [hh, mm] = value.split(":").map(Number);
    const dt = new Date(2000, 0, 1, hh, mm || 0, 0);
    return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
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

function norm(s) {
  return String(s || "").toLowerCase().trim();
}

function safeMessage(err, fallback) {
  return (
    err?.response?.data?.errors?.join(", ") ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
}

function sortSkills(skills) {
  return (skills || []).slice().sort((a, b) => {
    const levelDiff = (a.level ?? 0) - (b.level ?? 0);
    if (levelDiff !== 0) return levelDiff;
    return norm(a.name).localeCompare(norm(b.name));
  });
}

function occurrenceSignature(occ) {
  return JSON.stringify({
    id: String(occ?.id ?? ""),
    taught_on: occ?.taught_on || "",
    starts_at: occ?.starts_at || "",
    ends_at: occ?.ends_at || "",
    location: occ?.location || "",
  });
}

function occurrenceListsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;

  const aSorted = [...a].map(occurrenceSignature).sort();
  const bSorted = [...b].map(occurrenceSignature).sort();

  return aSorted.every((item, i) => item === bSorted[i]);
}

function makeTempOccurrenceId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function skillIdsEqual(a = [], b = []) {
  const aIds = a.map((s) => String(s.id)).sort();
  const bIds = b.map((s) => String(s.id)).sort();
  if (aIds.length !== bIds.length) return false;
  return aIds.every((id, i) => id === bIds[i]);
}

function SectionEmpty({ children }) {
  return (
    <div
      className="text-muted border rounded-3 p-3"
      style={{ background: "#fbfbfd", borderColor: "#e9ecef", fontSize: 14 }}
    >
      {children}
    </div>
  );
}

function SkillRow({ skill, removable, onRemove, disabled, isNew = false }) {
  return (
    <div
      className="border rounded-3 px-3 py-2 d-flex justify-content-between align-items-start gap-2 w-100"
      style={{
        background: isNew ? "#f3f8ff" : "#fff",
        borderColor: isNew ? "#cfe2ff" : "#e9ecef",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, lineHeight: 1.35 }}>
          <strong>Basic {skill.level}</strong> — {skill.name}
        </div>

        {isNew ? (
          <div className="mt-1">
            <Badge bg="primary" style={{ fontSize: 10 }}>
              Unsaved
            </Badge>
          </div>
        ) : null}
      </div>

      {removable ? (
        <Button
          size="sm"
          variant="outline-danger"
          className={`${BTN_CLASS} flex-shrink-0`}
          style={BTN_STYLE}
          onClick={onRemove}
          disabled={disabled}
        >
          Remove
        </Button>
      ) : null}
    </div>
  );
}

function LessonSectionCard({
  title,
  role,
  skills,
  notes,
  isEditing,
  saving,
  onNotesChange,
  onRemoveSkill,
  taughtIds,
  onToggleTaught,
  allSkills,
  addSkillsOpen,
  searchQuery,
  onToggleAddSkillsOpen,
  onSearchChange,
  onClearSearch,
  onToggleAddSkill,
  onClearAddedSelections,
  originalSkillIds,
}) {
  const hasNotes = Boolean((notes || "").trim());
  const currentSkillIds = new Set((skills || []).map((s) => s.id));

  const availableSkillsRaw = (allSkills || []).filter((s) => !currentSkillIds.has(s.id));
  const q = norm(searchQuery);
 const availableSkills = q
  ? availableSkillsRaw.filter((s) => {
      const name = norm(s?.name);
      const level = String(s?.level ?? "");
      const category = norm(s?.category);
      const basicLabel = `basic ${level}`.trim();

      return (
        name.includes(q) ||
        level.includes(q) ||
        category.includes(q) ||
        basicLabel.includes(q) ||
        (q.includes("basic") && level.length > 0)
      );
    })
  : availableSkillsRaw;

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

  return (
    <Card className="mb-3 border-0 shadow-sm">
      <Card.Body>
        <div className="d-flex align-items-center gap-2 mb-3">
          <SectionKicker>{title}</SectionKicker>
          <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
          <Badge bg="light" text="dark" className="border" style={{ fontSize: 11 }}>
            {skills.length}
          </Badge>
        </div>

        {isEditing ? (
  <div className="mb-3">
    <div className="d-flex justify-content-center">
      <Button
        size="sm"
        className={BTN_CLASS}
        style={BTN_STYLE}
        variant={addSkillsOpen ? "secondary" : "outline-secondary"}
        onClick={() => onToggleAddSkillsOpen(role)}
        disabled={saving}
        aria-expanded={addSkillsOpen}
        aria-controls={`add-skills-panel-${role}`}
      >
        {addSkillsOpen ? "Hide" : "Add Skills"}
      </Button>
    </div>

    {addSkillsOpen ? (
      <div
        id={`add-skills-panel-${role}`}
        className="border rounded-3 p-3 mt-3"
        style={{ background: "#fcfcff", borderColor: "#e9ecef" }}
      >
        <div className="d-flex align-items-center gap-2 mb-3">
          <SectionKicker>{title} Skill Builder</SectionKicker>
          <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
        </div>

        <div className="mb-3">
          <div className="fw-semibold mb-2" style={{ fontSize: 13 }}>
            Search
          </div>

          <div className="d-flex align-items-center gap-2">
            <Form.Control
              type="text"
              placeholder={`Search skills for ${title.toLowerCase()}…`}
              value={searchQuery}
              onChange={(e) => onSearchChange(role, e.target.value)}
              disabled={saving}
              style={{ borderRadius: 12 }}
            />
            <Button
              size="sm"
              className={BTN_CLASS}
              style={BTN_STYLE}
              variant="outline-secondary"
              onClick={() => onClearSearch(role)}
              disabled={saving || !searchQuery}
            >
              Clear
            </Button>
          </div>

          <div className="form-text mt-1">Search by name, level, or category.</div>
        </div>

        <div
          className="border rounded-3 p-3"
          style={{
            background: "#fff",
            borderColor: "#e9ecef",
            minHeight: 180,
          }}
        >
          {availableSkillsRaw.length === 0 ? (
            <p className="text-muted mb-0">No more skills available to add.</p>
          ) : levels.length === 0 ? (
            <p className="text-muted mb-0">
              {searchQuery ? "No matches for that search." : "No skills available to add."}
            </p>
          ) : (
            <div
              style={{
                maxHeight: 280,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {levels.map((lvl) => (
                <div key={`${role}-level-${lvl}`} className="mb-3">
                  <div className="fw-semibold mb-2">Basic {lvl}</div>

                  {sortSkills(availableByLevel[lvl]).map((skill) => (
                    <Form.Check
                      key={`${role}-available-${skill.id}`}
                      type="checkbox"
                      id={`add-${role}-skill-${skill.id}`}
                      label={skill.name}
                      checked={(skills || []).some((s) => s.id === skill.id)}
                      onChange={() => onToggleAddSkill(role, skill)}
                      disabled={saving}
                      className="mb-2"
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="d-flex gap-2 mt-3 flex-wrap">
          <Button
            size="sm"
            className={BTN_CLASS}
            style={BTN_STYLE}
            variant="outline-secondary"
            onClick={() => onClearAddedSelections(role, availableSkills)}
            disabled={saving}
          >
            Undo
          </Button>
        </div>
      </div>
    ) : null}
  </div>
) : null}


        <div className="mb-3">
          <div className="fw-semibold mb-2" style={{ fontSize: 14 }}>
            Skills
          </div>

          {skills.length === 0 ? (
            <SectionEmpty>No {title.toLowerCase()} skills added yet.</SectionEmpty>
          ) : !isEditing ? (
            <div className="d-grid" style={{ gap: 8 }}>
              {sortSkills(skills).map((skill) => {
                const checked = taughtIds.has(skill.id);

                return (
                  <div
                    key={`${role}-view-${skill.id}`}
                    className="border rounded-3 px-3 py-2"
                    style={{
                      background: checked ? "#f4f6f8" : "#fff",
                      borderColor: checked ? "#d6dde3" : "#e9ecef",
                      transition: "background-color 0.15s ease, border-color 0.15s ease",
                    }}
                  >
                    <Form.Check
                      type="checkbox"
                      id={`${role}-taught-${skill.id}`}
                      checked={checked}
                      onChange={() => onToggleTaught(role, skill.id)}
                      label={
                        <span
                          style={{
                            fontSize: 14,
                            textDecoration: checked ? "line-through" : "none",
                            opacity: checked ? 0.68 : 1,
                            transition: "all 0.15s ease",
                          }}
                        >
                          <strong>Basic {skill.level}</strong> — {skill.name}
                        </span>
                      }
                    />
                  </div>
                );
              })}
            </div>
                    ) : (
            <>
              
              {skills.length > 0 ? (
                <div className="d-grid mb-3" style={{ gap: 8 }}>
                  {skills.map((skill) => (
                    <SkillRow
                      key={`${role}-edit-${skill.id}`}
                      skill={skill}
                      removable
                      disabled={saving}
                      isNew={!originalSkillIds.has(skill.id)}
                      onRemove={() => onRemoveSkill(role, skill.id)}
                    />
                  ))}
                </div>
              ) : (
                <SectionEmpty>No {title.toLowerCase()} skills added yet.</SectionEmpty>
              )}
            </>
          )}
        </div>

        <div>
          <div className="fw-semibold mb-2" style={{ fontSize: 14 }}>
            Notes
          </div>

          {!isEditing ? (
            hasNotes ? (
              <div
                className="border rounded-3 p-3"
                style={{
                  background: "#fcfcff",
                  borderColor: "#e9ecef",
                  whiteSpace: "pre-wrap",
                  fontSize: 14,
                  lineHeight: 1.45,
                }}
              >
                {notes}
              </div>
            ) : (
              <SectionEmpty>No notes added for this section.</SectionEmpty>
            )
          ) : (
            <Form.Control
              as="textarea"
              rows={4}
              value={notes || ""}
              onChange={(e) => onNotesChange(e.target.value)}
              disabled={saving}
              placeholder={`Add notes for ${title.toLowerCase()}…`}
              style={{ borderRadius: 12 }}
            />
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

function UnsavedChangesModal({ show, saving, onSave, onDiscard, onKeepEditing }) {
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{
        background: "rgba(15, 23, 42, 0.28)",
        zIndex: 1055,
        padding: 16,
      }}
    >
      <Card
        className="border-0 shadow"
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 18,
        }}
      >
        <Card.Body className="p-4">
          <div className="d-flex align-items-center gap-2 mb-2">
            <Badge bg="warning" text="dark">
              Unsaved changes
            </Badge>
          </div>

          <h2 id="unsaved-changes-title" className="h5 mb-2">
            Save your changes before leaving?
          </h2>

          <p className="text-muted mb-4" style={{ fontSize: 14 }}>
            You have edits that have not been saved yet. You can save them now,
            discard them, or keep editing.
          </p>

          <div className="d-flex flex-wrap gap-2 justify-content-end">
            <Button
              size="sm"
              className={BTN_CLASS}
              style={BTN_STYLE}
              variant="outline-secondary"
              onClick={onKeepEditing}
              disabled={saving}
            >
              Keep editing
            </Button>

            <Button
              size="sm"
              className={BTN_CLASS}
              style={BTN_STYLE}
              variant="outline-danger"
              onClick={onDiscard}
              disabled={saving}
            >
              Discard changes
            </Button>

            <Button
              size="sm"
              className={BTN_CLASS}
              style={BTN_STYLE}
              variant="primary"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

class LessonPlanShow extends Component {
  state = {
    lessonPlan: null,
    skills: [],

    draftSkillsByRole: {
      main: [],
      warmup: [],
      cooldown: [],
    },

    taughtSkillIdsByRole: {
      main: new Set(),
      warmup: new Set(),
      cooldown: new Set(),
    },

    addSkillsOpenByRole: {
      main: false,
      warmup: false,
      cooldown: false,
    },

    skillSearchByRole: {
      main: "",
      warmup: "",
      cooldown: "",
    },

    isEditing: false,
    title: "",
    description: "",
    warmupNotes: "",
    mainNotes: "",
    cooldownNotes: "",

    draftOccurrences: [],
    overviewDatesOpen: false,

    loading: true,
    saving: false,
    error: null,
    success: null,

    duplicatedLessonPlanId: null,
    duplicatedLessonPlanTitle: "",

    newTaughtOn: "",
    newStartsAt: "",
    newEndsAt: "",
    newLocation: "",

    weeklyOverview: {},
    weeklyOverviewLoading: false,
    weeklyOverviewError: null,

    showUnsavedModal: false,
    pendingNavigation: null,
  };

  componentDidMount() {
    this.loadPage();
    this.loadWeeklyOverview();
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  }

  componentWillUnmount() {
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
  }

  handleBeforeUnload = (e) => {
    if (!this.hasUnsavedChanges()) return;
    e.preventDefault();
    e.returnValue = "";
  };

  buildDraftSkillsFromLessonPlan = (lp) => ({
    main: lp?.main_skills || lp?.skills || [],
    warmup: lp?.warmup_skills || [],
    cooldown: lp?.cooldown_skills || [],
  });

  buildDraftOccurrencesFromLessonPlan = (lp) =>
    (lp?.lesson_plan_occurrences || []).map((occ) => ({
      ...occ,
      _isNew: false,
    }));

  hasUnsavedChanges = () => {
    const { lessonPlan, isEditing } = this.state;
    if (!isEditing || !lessonPlan) return false;

    const originalMain = lessonPlan?.main_skills || lessonPlan?.skills || [];
    const originalWarmup = lessonPlan?.warmup_skills || [];
    const originalCooldown = lessonPlan?.cooldown_skills || [];

    const titleChanged = (this.state.title || "") !== (lessonPlan.title || "");
    const descriptionChanged = (this.state.description || "") !== (lessonPlan.description || "");
    const warmupNotesChanged = (this.state.warmupNotes || "") !== (lessonPlan.warmup_notes || "");
    const mainNotesChanged = (this.state.mainNotes || "") !== (lessonPlan.main_notes || "");
    const cooldownNotesChanged = (this.state.cooldownNotes || "") !== (lessonPlan.cooldown_notes || "");

    const occurrencesChanged = !occurrenceListsEqual(
      this.state.draftOccurrences,
      this.buildDraftOccurrencesFromLessonPlan(lessonPlan)
    );

    const mainSkillsChanged = !skillIdsEqual(this.state.draftSkillsByRole.main, originalMain);
    const warmupSkillsChanged = !skillIdsEqual(this.state.draftSkillsByRole.warmup, originalWarmup);
    const cooldownSkillsChanged = !skillIdsEqual(this.state.draftSkillsByRole.cooldown, originalCooldown);

    return (
      titleChanged ||
      descriptionChanged ||
      warmupNotesChanged ||
      mainNotesChanged ||
      cooldownNotesChanged ||
      mainSkillsChanged ||
      warmupSkillsChanged ||
      cooldownSkillsChanged ||
      occurrencesChanged
    );
  };

  requestNavigation = (fn) => {
    if (this.hasUnsavedChanges()) {
      this.setState({
        showUnsavedModal: true,
        pendingNavigation: fn,
      });
      return;
    }
    fn();
  };

  continuePendingNavigation = () => {
    const fn = this.state.pendingNavigation;
    this.setState({ showUnsavedModal: false, pendingNavigation: null }, () => {
      if (typeof fn === "function") fn();
    });
  };

  discardChangesAndContinue = () => {
    const lp = this.state.lessonPlan;
    this.setState(
      {
        isEditing: false,
        title: lp?.title || "",
        description: lp?.description || "",
        warmupNotes: lp?.warmup_notes || "",
        mainNotes: lp?.main_notes || "",
        cooldownNotes: lp?.cooldown_notes || "",
        draftSkillsByRole: this.buildDraftSkillsFromLessonPlan(lp),
        draftOccurrences: this.buildDraftOccurrencesFromLessonPlan(lp),
        addSkillsOpenByRole: {
          main: false,
          warmup: false,
          cooldown: false,
        },
        skillSearchByRole: {
          main: "",
          warmup: "",
          cooldown: "",
        },
        error: null,
        success: null,
        duplicatedLessonPlanId: null,
        duplicatedLessonPlanTitle: "",
        showUnsavedModal: false,
      },
      this.continuePendingNavigation
    );
  };

  saveChangesAndContinue = async () => {
    const ok = await this.saveLessonPlan();
    if (ok) this.continuePendingNavigation();
  };

  scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(() => {
      if (typeof el.focus === "function") el.focus();
    }, 250);
  };

  loadPage = () => {
    const { id } = this.props.params;
    const { rosterId } = this.props;

    const lpParams = rosterId ? { roster_id: rosterId } : undefined;

    this.setState({
      loading: true,
      error: null,
      success: null,
      duplicatedLessonPlanId: null,
      duplicatedLessonPlanTitle: "",
    });

    Promise.all([api.get(`/lesson_plans/${id}`, { params: lpParams }), api.get(`/skills`)])
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
          draftSkillsByRole: this.buildDraftSkillsFromLessonPlan(lp),
          draftOccurrences: this.buildDraftOccurrencesFromLessonPlan(lp),
          loading: false,
          saving: false,
        });
      })
      .catch((err) => {
        this.setState({
          error: safeMessage(err, "Failed to load lesson plan"),
          loading: false,
          saving: false,
        });
      });
  };

  startEdit = () => {
    const lp = this.state.lessonPlan;
    this.setState({
      isEditing: true,
      success: null,
      error: null,
      duplicatedLessonPlanId: null,
      duplicatedLessonPlanTitle: "",
      title: lp?.title || "",
      description: lp?.description || "",
      warmupNotes: lp?.warmup_notes || "",
      mainNotes: lp?.main_notes || "",
      cooldownNotes: lp?.cooldown_notes || "",
      draftSkillsByRole: this.buildDraftSkillsFromLessonPlan(lp),
      draftOccurrences: this.buildDraftOccurrencesFromLessonPlan(lp),
      addSkillsOpenByRole: {
        main: false,
        warmup: false,
        cooldown: false,
      },
      skillSearchByRole: {
        main: "",
        warmup: "",
        cooldown: "",
      },
    });
  };

  cancelEdit = () => {
    this.requestNavigation(() => {
      const lp = this.state.lessonPlan;
      this.setState({
        isEditing: false,
        title: lp?.title || "",
        description: lp?.description || "",
        warmupNotes: lp?.warmup_notes || "",
        mainNotes: lp?.main_notes || "",
        cooldownNotes: lp?.cooldown_notes || "",
        draftSkillsByRole: this.buildDraftSkillsFromLessonPlan(lp),
        draftOccurrences: this.buildDraftOccurrencesFromLessonPlan(lp),
        addSkillsOpenByRole: {
          main: false,
          warmup: false,
          cooldown: false,
        },
        skillSearchByRole: {
          main: "",
          warmup: "",
          cooldown: "",
        },
        success: null,
        error: null,
        duplicatedLessonPlanId: null,
        duplicatedLessonPlanTitle: "",
      });
    });
  };

  handleFieldChange = (e) => this.setState({ [e.target.name]: e.target.value });

  toggleAddSkillsOpen = (role) => {
    this.setState((prev) => ({
      addSkillsOpenByRole: {
        ...prev.addSkillsOpenByRole,
        [role]: !prev.addSkillsOpenByRole[role],
      },
    }));
  };

  changeSkillSearch = (role, value) => {
    this.setState((prev) => ({
      skillSearchByRole: {
        ...prev.skillSearchByRole,
        [role]: value,
      },
    }));
  };

  clearSkillSearch = (role) => {
    this.setState((prev) => ({
      skillSearchByRole: {
        ...prev.skillSearchByRole,
        [role]: "",
      },
    }));
  };

  duplicateLessonPlan = async () => {
    const { id } = this.props.params;

    this.setState({
      saving: true,
      error: null,
      success: null,
      duplicatedLessonPlanId: null,
      duplicatedLessonPlanTitle: "",
    });

    try {
      const res = await api.post(`/lesson_plans/${id}/duplicate`);
      const duplicated = res.data;

      this.setState({
        saving: false,
        success: "Lesson plan duplicated!",
        duplicatedLessonPlanId: duplicated?.id || null,
        duplicatedLessonPlanTitle: duplicated?.title || "",
      });
    } catch (err) {
      this.setState({
        saving: false,
        error: safeMessage(err, "Failed to duplicate lesson plan"),
        duplicatedLessonPlanId: null,
        duplicatedLessonPlanTitle: "",
      });
    }
  };

  saveLessonPlan = async () => {
    const { id } = this.props.params;
    const {
      lessonPlan,
      title,
      description,
      warmupNotes,
      mainNotes,
      cooldownNotes,
      draftSkillsByRole,
    } = this.state;

    const payload = {
      lesson_plan: {
        title: (title || "").trim(),
        description: (description || "").trim(),
        warmup_notes: (warmupNotes ?? "").trim() || null,
        main_notes: (mainNotes ?? "").trim() || null,
        cooldown_notes: (cooldownNotes ?? "").trim() || null,
      },
    };

    const original = {
      main: lessonPlan?.main_skills || lessonPlan?.skills || [],
      warmup: lessonPlan?.warmup_skills || [],
      cooldown: lessonPlan?.cooldown_skills || [],
    };

    const originalIds = {
      main: new Set(original.main.map((s) => s.id)),
      warmup: new Set(original.warmup.map((s) => s.id)),
      cooldown: new Set(original.cooldown.map((s) => s.id)),
    };

    const draftIds = {
      main: new Set((draftSkillsByRole.main || []).map((s) => s.id)),
      warmup: new Set((draftSkillsByRole.warmup || []).map((s) => s.id)),
      cooldown: new Set((draftSkillsByRole.cooldown || []).map((s) => s.id)),
    };

    const removedByRole = {
      main: [...originalIds.main].filter((id) => !draftIds.main.has(id)),
      warmup: [...originalIds.warmup].filter((id) => !draftIds.warmup.has(id)),
      cooldown: [...originalIds.cooldown].filter((id) => !draftIds.cooldown.has(id)),
    };

    const addedByRole = {
      main: [...draftIds.main].filter((id) => !originalIds.main.has(id)),
      warmup: [...draftIds.warmup].filter((id) => !originalIds.warmup.has(id)),
      cooldown: [...draftIds.cooldown].filter((id) => !originalIds.cooldown.has(id)),
    };

    const originalOccurrences = this.buildDraftOccurrencesFromLessonPlan(lessonPlan);
    const draftOccurrences = this.state.draftOccurrences || [];

    const originalOccurrenceIds = new Set(
      originalOccurrences
        .filter((occ) => !String(occ.id).startsWith("temp-"))
        .map((occ) => String(occ.id))
    );

    const keptPersistedOccurrenceIds = new Set(
      draftOccurrences
        .filter((occ) => !String(occ.id).startsWith("temp-"))
        .map((occ) => String(occ.id))
    );

    const removedOccurrenceIds = [...originalOccurrenceIds].filter(
      (id) => !keptPersistedOccurrenceIds.has(id)
    );

    const newOccurrences = draftOccurrences.filter(
      (occ) => String(occ.id).startsWith("temp-") || occ._isNew
    );

    this.setState({
      saving: true,
      error: null,
      success: null,
      duplicatedLessonPlanId: null,
      duplicatedLessonPlanTitle: "",
    });

    try {
      await api.patch(`/lesson_plans/${id}`, payload);

      for (const skillId of removedByRole.main) {
        await api.delete(`/lesson_plans/${id}/remove_skill/${skillId}`, { params: { role: "main" } });
      }
      for (const skillId of removedByRole.warmup) {
        await api.delete(`/lesson_plans/${id}/remove_skill/${skillId}`, { params: { role: "warmup" } });
      }
      for (const skillId of removedByRole.cooldown) {
        await api.delete(`/lesson_plans/${id}/remove_skill/${skillId}`, { params: { role: "cooldown" } });
      }

      if (addedByRole.main.length) {
        await api.post(`/lesson_plans/${id}/add_skills`, {
          skill_ids: addedByRole.main,
          role: "main",
        });
      }
      if (addedByRole.warmup.length) {
        await api.post(`/lesson_plans/${id}/add_skills`, {
          skill_ids: addedByRole.warmup,
          role: "warmup",
        });
      }
      if (addedByRole.cooldown.length) {
        await api.post(`/lesson_plans/${id}/add_skills`, {
          skill_ids: addedByRole.cooldown,
          role: "cooldown",
        });
      }

      for (const occurrenceId of removedOccurrenceIds) {
        await api.delete(`/lesson_plans/${id}/lesson_plan_occurrences/${occurrenceId}`);
      }

      for (const occ of newOccurrences) {
        await api.post(`/lesson_plans/${id}/lesson_plan_occurrences`, {
          lesson_plan_occurrence: {
            taught_on: occ.taught_on,
            starts_at: occ.starts_at || null,
            ends_at: occ.ends_at || null,
            location: occ.location || null,
          },
        });
      }

      const refreshed = await api.get(`/lesson_plans/${id}`, {
        params: this.props.rosterId ? { roster_id: this.props.rosterId } : undefined,
      });
      const updated = refreshed.data;

      this.setState({
        lessonPlan: updated,
        title: updated.title || "",
        description: updated.description || "",
        warmupNotes: updated.warmup_notes || "",
        mainNotes: updated.main_notes || "",
        cooldownNotes: updated.cooldown_notes || "",
        draftSkillsByRole: this.buildDraftSkillsFromLessonPlan(updated),
        draftOccurrences: this.buildDraftOccurrencesFromLessonPlan(updated),
        isEditing: false,
        addSkillsOpenByRole: {
          main: false,
          warmup: false,
          cooldown: false,
        },
        skillSearchByRole: {
          main: "",
          warmup: "",
          cooldown: "",
        },
        saving: false,
        success: "Lesson plan updated!",
      });

      return true;
    } catch (err) {
      this.setState({
        error: safeMessage(err, "Failed to update lesson plan"),
        saving: false,
      });
      return false;
    }
  };

  removeSkill = (role, skillId) => {
    this.setState((prev) => ({
      draftSkillsByRole: {
        ...prev.draftSkillsByRole,
        [role]: (prev.draftSkillsByRole[role] || []).filter((s) => s.id !== skillId),
      },
      success: null,
      error: null,
    }));
  };

  toggleAddSkill = (role, skill) => {
    this.setState((prev) => {
      const current = prev.draftSkillsByRole[role] || [];
      const exists = current.some((s) => s.id === skill.id);

      return {
        draftSkillsByRole: {
          ...prev.draftSkillsByRole,
          [role]: exists ? current.filter((s) => s.id !== skill.id) : [...current, skill],
        },
        success: null,
        error: null,
      };
    });
  };

  clearAddedSelections = (role, availableSkills) => {
    const availableIds = new Set((availableSkills || []).map((s) => s.id));

    this.setState((prev) => ({
      draftSkillsByRole: {
        ...prev.draftSkillsByRole,
        [role]: (prev.draftSkillsByRole[role] || []).filter((s) => !availableIds.has(s.id)),
      },
    }));
  };

  toggleTaught = (role, skillId) => {
    this.setState((prev) => {
      const next = { ...prev.taughtSkillIdsByRole };
      const setCopy = new Set(next[role]);
      if (setCopy.has(skillId)) setCopy.delete(skillId);
      else setCopy.add(skillId);
      next[role] = setCopy;
      return { taughtSkillIdsByRole: next };
    });
  };

  handleOccFieldChange = (e) => {
    this.setState({ [e.target.name]: e.target.value });
  };

  createOccurrence = (e) => {
    e.preventDefault();

    const { newTaughtOn, newStartsAt, newEndsAt, newLocation } = this.state;

    if (!newTaughtOn) {
      this.setState({ error: "Please choose a date." });
      return;
    }

    const draftOccurrence = {
      id: makeTempOccurrenceId(),
      taught_on: newTaughtOn,
      starts_at: newStartsAt || null,
      ends_at: newEndsAt || null,
      location: newLocation.trim() || null,
      _isNew: true,
    };

    this.setState((prev) => ({
      draftOccurrences: [...prev.draftOccurrences, draftOccurrence],
      newTaughtOn: "",
      newStartsAt: "",
      newEndsAt: "",
      newLocation: "",
      error: null,
      success: "Scheduled date added. Save changes to keep it.",
    }));
  };

  deleteOccurrence = (occurrenceId) => {
    if (!window.confirm("Remove this scheduled date?")) return;

    this.setState((prev) => ({
      draftOccurrences: (prev.draftOccurrences || []).filter((occ) => occ.id !== occurrenceId),
      success: null,
      error: null,
    }));
  };

  deleteLessonPlan = () => {
    const { id } = this.props.params;
    if (!window.confirm("Delete this lesson plan? This cannot be undone.")) return;

    this.setState({ saving: true, error: null });

    api
      .delete(`/lesson_plans/${id}`)
      .then(() => this.props.navigate("/lesson-plans"))
      .catch((err) => {
        this.setState({
          error: safeMessage(err, "Failed to delete lesson plan"),
          saving: false,
        });
      });
  };

  getMatchingWeeklyRostersForOccurrence = (occ) => {
    const wd = localWeekdayFromYmd(occ?.taught_on);
    if (wd == null) return [];

    const occStart = timeToMinutes(occ?.starts_at);
    const occEnd = timeToMinutes(occ?.ends_at);

    const dayRows = (this.state.weeklyOverview || {})[wd] || [];
    if (!dayRows.length) return [];
    if (occStart == null && occEnd == null) return [];

    const matches = dayRows.filter(({ schedule }) => {
      const sStart = timeToMinutes(schedule?.starts_at);
      const sEnd = timeToMinutes(schedule?.ends_at);

      if (occStart != null && occEnd != null && sStart != null && sEnd != null) {
        const exact =
          approxEqualMinutes(occStart, sStart, 3) && approxEqualMinutes(occEnd, sEnd, 3);

        const buffer = 2;
        const occA = occStart - buffer;
        const occB = occEnd + buffer;
        const schA = sStart - buffer;
        const schB = sEnd + buffer;

        const overlaps = occA < schB && occB > schA;
        return exact || overlaps;
      }

      if (occStart != null && sStart != null) {
        return approxEqualMinutes(occStart, sStart, 5);
      }

      return false;
    });

    const byId = new Map();
    matches.forEach(({ roster }) => {
      if (roster?.id != null) byId.set(String(roster.id), roster);
    });

    return Array.from(byId.values());
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
      this.setState({
        weeklyOverviewError: safeMessage(err, "Failed to load weekly overview"),
        weeklyOverviewLoading: false,
      });
    }
  };

  render() {
    const {
      lessonPlan,
      skills,
      draftSkillsByRole,
      taughtSkillIdsByRole,
      isEditing,
      title,
      description,
      loading,
      saving,
      error,
      success,
      showUnsavedModal,
      addSkillsOpenByRole,
      skillSearchByRole,
      duplicatedLessonPlanId,
    } = this.state;

    if (loading) return <p className="m-4">Loading lesson plan…</p>;

    if (error && !lessonPlan) {
      return (
        <Alert variant="danger" className="m-4">
          {error}
        </Alert>
      );
    }

    const originalMainSkills = lessonPlan?.main_skills || lessonPlan?.skills || [];
    const originalWarmupSkills = lessonPlan?.warmup_skills || [];
    const originalCooldownSkills = lessonPlan?.cooldown_skills || [];

    const mainSkills = isEditing ? draftSkillsByRole.main : originalMainSkills;
    const warmupSkills = isEditing ? draftSkillsByRole.warmup : originalWarmupSkills;
    const cooldownSkills = isEditing ? draftSkillsByRole.cooldown : originalCooldownSkills;
    const occurrences = lessonPlan?.lesson_plan_occurrences || [];
    const draftOccurrences = this.state.draftOccurrences || [];

    const hasUnsaved = this.hasUnsavedChanges();

    const tocItems = [
      { id: "lesson-overview", label: "Overview" },
      { id: "section-warmup", label: `Warm-up (${warmupSkills.length})` },
      { id: "section-main", label: `Main Lesson (${mainSkills.length})` },
      { id: "section-cooldown", label: `Cool-down (${cooldownSkills.length})` },
      ...(isEditing ? [{ id: "section-scheduler", label: `Scheduler (${draftOccurrences.length})` }] : []),
    ];

    return (
      <>
        <div className="container mt-4" style={{ maxWidth: 1100 }}>
          {success && (
            <Alert variant="success" className="mb-3">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div>{success}</div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                  {duplicatedLessonPlanId ? (
                    <Button
                      size="sm"
                      className={BTN_CLASS}
                      style={BTN_STYLE}
                      variant="outline-success"
                      onClick={() => this.props.navigate(`/lesson-plans/${duplicatedLessonPlanId}`)}
                    >
                      Open Duplicate
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    className={BTN_CLASS}
                    style={BTN_STYLE}
                    variant="outline-secondary"
                    onClick={() =>
                      this.setState({
                        success: null,
                        duplicatedLessonPlanId: null,
                        duplicatedLessonPlanTitle: "",
                      })
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </Alert>
          )}

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <a
                href="/lesson-plans"
                className="text-decoration-none"
                onClick={(e) => {
                  e.preventDefault();
                  this.requestNavigation(() => this.props.navigate("/lesson-plans"));
                }}
              >
                ← Back to lesson plans
              </a>

              {this.props.rosterId ? (
                <>
                  <span className="text-muted">•</span>
                  <a
                    href={`/rosters/${this.props.rosterId}`}
                    className="text-decoration-none"
                    onClick={(e) => {
                      e.preventDefault();
                      this.requestNavigation(() => this.props.navigate(`/rosters/${this.props.rosterId}`));
                    }}
                  >
                    Back to roster
                  </a>
                </>
              ) : null}
            </div>

            {!isEditing ? (
              <div className="d-flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  className={BTN_CLASS}
                  style={BTN_STYLE}
                  variant="primary"
                  onClick={this.startEdit}
                >
                  Edit plan
                </Button>
                <Button
                  size="sm"
                  className={BTN_CLASS}
                  style={BTN_STYLE}
                  variant="outline-secondary"
                  onClick={this.duplicateLessonPlan}
                  disabled={saving}
                >
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  className={BTN_CLASS}
                  style={BTN_STYLE}
                  variant="outline-danger"
                  onClick={this.deleteLessonPlan}
                  disabled={saving}
                >
                  Delete plan
                </Button>
              </div>
            ) : (
              <div className="d-flex gap-2 flex-wrap align-items-center">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  className={BTN_CLASS}
                  style={BTN_STYLE}
                  onClick={this.cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </Button>

                <Button
                  size="sm"
                  variant={hasUnsaved ? "primary" : "secondary"}
                  className={BTN_CLASS}
                  style={BTN_STYLE}
                  onClick={this.saveLessonPlan}
                  disabled={saving || !hasUnsaved}
                >
                  {saving ? "Saving..." : hasUnsaved ? "Save Changes" : "All Changes Saved"}
                </Button>
              </div>
            )}
          </div>

          <div id="lesson-overview" tabIndex="-1">
            <Card className="mb-4 border-0 shadow-sm" style={{ borderRadius: 18 }}>
              <Card.Body className="p-4">
                {!isEditing ? (
                  <div className="d-flex flex-column gap-4">
                    <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start gap-4">
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <SectionKicker className="mb-2">Lesson Overview</SectionKicker>

                        <Card.Title
                          className="mb-2"
                          style={{
                            fontSize: "1.85rem",
                            lineHeight: 1.15,
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {lessonPlan.title}
                        </Card.Title>

                        {lessonPlan.description ? (
                          <div
                            className="d-flex align-items-start gap-2 text-muted"
                            style={{
                              fontSize: 15,
                              lineHeight: 1.55,
                              maxWidth: 760,
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                fontSize: 16,
                                lineHeight: 1.4,
                                marginTop: 1,
                                color: "#6c757d",
                              }}
                            >
                              ↳
                            </span>
                            <div>{lessonPlan.description}</div>
                          </div>
                        ) : (
                          <div className="text-muted" style={{ fontSize: 14 }}>
                            No description added.
                          </div>
                        )}

                        <div className="mt-4">
                          <div className="text-muted mb-3" style={{ fontSize: 13 }}>
                            <b>Created</b>: {formatDateLong(lessonPlan.created_at)}
                          </div>

                          <div className="text-muted mb-3" style={{ fontSize: 13 }}>
                            <b>Scheduled for:</b>
                          </div>

                          {occurrences.length === 0 ? (
                            <div className="text-muted" style={{ fontSize: 13 }}>
                              No scheduled dates yet
                            </div>
                          ) : (
                            <div className="d-flex flex-wrap align-items-center" style={{ gap: 8 }}>
                              {occurrences
                                .slice()
                                .sort((a, b) => (a.taught_on || "").localeCompare(b.taught_on || ""))
                                .map((occ) => (
                                  <a
                                    key={occ.id}
                                    href={`/calendar?date=${encodeURIComponent(occ.taught_on)}`}
                                    className="text-decoration-none"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      this.requestNavigation(() =>
                                        this.props.navigate(
                                          `/calendar?date=${encodeURIComponent(occ.taught_on)}`
                                        )
                                      );
                                    }}
                                  >
                                    <Badge
                                      bg="light"
                                      text="dark"
                                      className="border"
                                      style={{
                                        fontWeight: 500,
                                        fontSize: 12,
                                        padding: "6px 10px",
                                        borderRadius: 999,
                                      }}
                                    >
                                      {formatDateShort(occ.taught_on)}
                                    </Badge>
                                  </a>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className="border rounded-4 p-3"
                        style={{
                          minWidth: 240,
                          background: "#fcfcff",
                          borderColor: "#e9ecef",
                        }}
                      >
                        <div className="fw-semibold mb-2" style={{ fontSize: 14 }}>
                          On this page
                        </div>

                        <div className="d-flex flex-column align-items-start" style={{ gap: 6 }}>
                          {tocItems.map((item) => (
                            <Button
                              key={item.id}
                              variant="link"
                              className="p-0 text-decoration-none text-start"
                              style={{ fontSize: 14, color: "#495057" }}
                              onClick={() => this.scrollToSection(item.id)}
                            >
                              {item.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="d-flex flex-column flex-xl-row gap-4 align-items-start">
                    <div style={{ flex: 1, minWidth: 0, maxWidth: 760 }}>
                      <div className="d-flex align-items-center gap-2 mb-3">
                        <SectionKicker>Lesson Plan Builder</SectionKicker>
                        <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
                      </div>

                      <div className="text-muted mb-4" style={{ fontSize: 13, lineHeight: 1.5 }}>
                        Update the lesson title and description here, then jump to any section below to
                        edit skills, notes, or scheduling details.
                      </div>

                      <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold">Title</Form.Label>
                        <Form.Control
                          name="title"
                          value={title}
                          onChange={this.handleFieldChange}
                          disabled={saving}
                          placeholder="Lesson plan title"
                          style={{ borderRadius: 12 }}
                        />
                      </Form.Group>

                      <Form.Group>
                        <Form.Label className="fw-semibold">Description</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          name="description"
                          value={description}
                          onChange={this.handleFieldChange}
                          disabled={saving}
                          placeholder="Optional lesson overview, goals, or reminders…"
                          style={{ borderRadius: 12 }}
                        />
                      </Form.Group>
                    </div>

                    <div
                      className="border rounded-4 p-3"
                      style={{
                        width: "100%",
                        maxWidth: 260,
                        background: "#fcfcff",
                        borderColor: "#e9ecef",
                      }}
                    >
                      <div className="fw-semibold mb-2" style={{ fontSize: 14 }}>
                        Jump to section
                      </div>

                      <div className="d-flex flex-column align-items-start" style={{ gap: 6 }}>
                        {tocItems.map((item) => (
                          <Button
                            key={item.id}
                            variant="link"
                            className="p-0 text-decoration-none text-start"
                            style={{ fontSize: 14, color: "#495057" }}
                            onClick={() => this.scrollToSection(item.id)}
                          >
                            {item.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          </div>

          <div id="section-warmup" tabIndex="-1">
            <LessonSectionCard
              title="Warm-up"
              role={ROLE.WARMUP}
              skills={warmupSkills}
              notes={this.state.warmupNotes}
              isEditing={isEditing}
              saving={saving}
              onNotesChange={(value) => this.setState({ warmupNotes: value })}
              onRemoveSkill={this.removeSkill}
              taughtIds={taughtSkillIdsByRole.warmup}
              onToggleTaught={this.toggleTaught}
              allSkills={skills}
              addSkillsOpen={addSkillsOpenByRole.warmup}
              searchQuery={skillSearchByRole.warmup}
              onToggleAddSkillsOpen={this.toggleAddSkillsOpen}
              onSearchChange={this.changeSkillSearch}
              onClearSearch={this.clearSkillSearch}
              onToggleAddSkill={this.toggleAddSkill}
              onClearAddedSelections={this.clearAddedSelections}
              originalSkillIds={new Set(originalWarmupSkills.map((s) => s.id))}
            />
          </div>

          <div id="section-main" tabIndex="-1">
            <LessonSectionCard
              title="Main Lesson"
              role={ROLE.MAIN}
              skills={mainSkills}
              notes={this.state.mainNotes}
              isEditing={isEditing}
              saving={saving}
              onNotesChange={(value) => this.setState({ mainNotes: value })}
              onRemoveSkill={this.removeSkill}
              taughtIds={taughtSkillIdsByRole.main}
              onToggleTaught={this.toggleTaught}
              allSkills={skills}
              addSkillsOpen={addSkillsOpenByRole.main}
              searchQuery={skillSearchByRole.main}
              onToggleAddSkillsOpen={this.toggleAddSkillsOpen}
              onSearchChange={this.changeSkillSearch}
              onClearSearch={this.clearSkillSearch}
              onToggleAddSkill={this.toggleAddSkill}
              onClearAddedSelections={this.clearAddedSelections}
              originalSkillIds={new Set(originalMainSkills.map((s) => s.id))}
            />
          </div>

          <div id="section-cooldown" tabIndex="-1">
            <LessonSectionCard
              title="Cool-down"
              role={ROLE.COOLDOWN}
              skills={cooldownSkills}
              notes={this.state.cooldownNotes}
              isEditing={isEditing}
              saving={saving}
              onNotesChange={(value) => this.setState({ cooldownNotes: value })}
              onRemoveSkill={this.removeSkill}
              taughtIds={taughtSkillIdsByRole.cooldown}
              onToggleTaught={this.toggleTaught}
              allSkills={skills}
              addSkillsOpen={addSkillsOpenByRole.cooldown}
              searchQuery={skillSearchByRole.cooldown}
              onToggleAddSkillsOpen={this.toggleAddSkillsOpen}
              onSearchChange={this.changeSkillSearch}
              onClearSearch={this.clearSkillSearch}
              onToggleAddSkill={this.toggleAddSkill}
              onClearAddedSelections={this.clearAddedSelections}
              originalSkillIds={new Set(originalCooldownSkills.map((s) => s.id))}
            />
          </div>

          <div id="section-scheduler" tabIndex="-1" style={{ scrollMarginTop: 24 }}>
            {isEditing ? (
              <div className="mt-5 pt-2">
                <div
                  className="mb-3"
                  style={{
                    height: 1,
                    background: "linear-gradient(90deg, rgba(0,0,0,0.08), rgba(0,0,0,0.02))",
                  }}
                />

                <Card className="mt-4 border-0 shadow-sm" style={{ borderRadius: 14 }}>
                  <Card.Body>
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                      <Card.Title className="mb-0">Lesson Plan Scheduler</Card.Title>
                    </div>

                    <div className="mt-3">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <SectionKicker>My weekly schedule</SectionKicker>
                        <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
                      </div>

                      {this.state.weeklyOverviewError ? (
                        <Alert variant="danger" className="mb-2">
                          {this.state.weeklyOverviewError}
                        </Alert>
                      ) : null}

                      {this.state.weeklyOverviewLoading ? (
                        <div className="text-muted" style={{ fontSize: 13 }}>
                          Loading weekly schedule…
                        </div>
                      ) : (
                        <Row className="g-2">
                          {Array.from({ length: 7 }).map((_, wd) => {
                            const rows = (this.state.weeklyOverview || {})[wd] || [];
                            return (
                              <Col key={wd} xs={12} sm={6} md={3} lg>
                                <div className="border rounded-3 p-2 h-100" style={{ background: "#fff" }}>
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
                                                  textOverflow: "ellipsis",
                                                }}
                                                title={roster?.name || ""}
                                              >
                                                {roster?.name || "Roster"}
                                              </div>

                                              <div
                                                className="text-muted"
                                                style={{ fontSize: 11, lineHeight: 1.15 }}
                                              >
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

                    <div className="mt-3">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <SectionKicker>Lesson plan scheduled dates</SectionKicker>
                        <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
                        <Badge bg="light" text="dark">
                          {draftOccurrences.length}
                        </Badge>
                      </div>

                      {draftOccurrences.length === 0 ? (
                        <p className="text-muted mb-0 mt-2">No dates scheduled yet.</p>
                      ) : (
                        <div className="d-grid mt-2" style={{ gap: 8 }}>
                          {draftOccurrences
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
                                    background: occ._isNew ? "#f3f8ff" : "#fbfbfd",
                                    borderColor: occ._isNew ? "#cfe2ff" : "#e9ecef",
                                  }}
                                >
                                  <div style={{ minWidth: 0 }}>
                                    <div className="d-flex flex-wrap align-items-center" style={{ gap: 10 }}>
                                      <a
                                        href={`/calendar?date=${encodeURIComponent(occ.taught_on)}`}
                                        className="text-decoration-none fw-semibold"
                                        style={{ fontSize: 13 }}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          this.requestNavigation(() =>
                                            this.props.navigate(
                                              `/calendar?date=${encodeURIComponent(occ.taught_on)}`
                                            )
                                          );
                                        }}
                                      >
                                        {formatDateShort(occ.taught_on)}
                                      </a>

                                      {time ? (
                                        <span className="text-muted" style={{ fontSize: 12 }}>
                                          {compactRange(occ.starts_at, occ.ends_at) || time}
                                        </span>
                                      ) : null}

                                      {rosters.length > 0 ? (
                                        <div className="d-flex flex-wrap align-items-center" style={{ gap: 6 }}>
                                          {rosters.slice(0, 2).map((r) => (
                                            <a
                                              key={r.id}
                                              href={`/rosters/${r.id}`}
                                              className="text-decoration-none"
                                              title={r.name || "Roster"}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                this.requestNavigation(() =>
                                                  this.props.navigate(`/rosters/${r.id}`)
                                                );
                                              }}
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
                                            </a>
                                          ))}

                                          {rosters.length > 2 ? (
                                            <span className="text-muted" style={{ fontSize: 12 }}>
                                              +{rosters.length - 2}
                                            </span>
                                          ) : null}
                                        </div>
                                      ) : null}

                                      {occ._isNew ? (
                                        <Badge bg="primary" style={{ fontSize: 10 }}>
                                          Unsaved
                                        </Badge>
                                      ) : null}
                                    </div>

                                    {occ.location ? (
                                      <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                                        {occ.location}
                                      </div>
                                    ) : null}
                                  </div>

                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => this.deleteOccurrence(occ.id)}
                                    disabled={saving}
                                    className={BTN_CLASS}
                                    style={BTN_STYLE}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

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
                          <Button
                            type="submit"
                            size="sm"
                            className={`w-100 ${BTN_CLASS}`}
                            style={BTN_STYLE}
                            variant="primary"
                            disabled={saving}
                          >
                            Add
                          </Button>
                        </Col>
                      </Row>

                      <div className="mt-2 d-flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          type="button"
                          className={BTN_CLASS}
                          style={BTN_STYLE}
                          variant="outline-secondary"
                          disabled={saving}
                          onClick={() =>
                            this.setState({
                              newTaughtOn: "",
                              newStartsAt: "",
                              newEndsAt: "",
                              newLocation: "",
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
            ) : null}
          </div>
        </div>

        <UnsavedChangesModal
          show={showUnsavedModal}
          saving={saving}
          onSave={this.saveChangesAndContinue}
          onDiscard={this.discardChangesAndContinue}
          onKeepEditing={() => this.setState({ showUnsavedModal: false, pendingNavigation: null })}
        />
      </>
    );
  }
}

export default withParams(LessonPlanShow);