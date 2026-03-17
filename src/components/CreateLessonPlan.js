import React, { Component } from "react";
import api from "../api";
import { useNavigate, useSearchParams } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

function CreateLessonPlanWithNavAndQuery(props) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dateParam = searchParams.get("date");
  return <CreateLessonPlan {...props} dateParam={dateParam} navigate={navigate} />;
}

export default CreateLessonPlanWithNavAndQuery;

const BTN_CLASS = "rounded-pill px-3";
const BTN_STYLE = { fontSize: 12 };

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

function norm(s) {
  return String(s || "").toLowerCase().trim();
}

function safeErrors(err, fallback) {
  const raw =
    err?.response?.data?.errors ||
    err?.response?.data?.error ||
    err?.message ||
    fallback;
  return Array.isArray(raw) ? raw : [String(raw)];
}

function sortSkills(skills) {
  return (skills || []).slice().sort((a, b) => {
    const levelDiff = (a.level ?? 0) - (b.level ?? 0);
    if (levelDiff !== 0) return levelDiff;
    return norm(a.name).localeCompare(norm(b.name));
  });
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

class CreateLessonPlan extends Component {
  state = {
    title: "",
    description: "",

    skills: [],

    draftSkillsByRole: {
      main: [],
      warmup: [],
      cooldown: [],
    },

    warmupNotes: "",
    mainNotes: "",
    cooldownNotes: "",

    addSkillsOpenByRole: {
      main: true,
      warmup: false,
      cooldown: false,
    },

    skillSearchByRole: {
      main: "",
      warmup: "",
      cooldown: "",
    },

    loadingSkills: true,
    saving: false,
    error: null,
    success: null,
  };

  componentDidMount() {
    this.loadSkills();
  }

  loadSkills = async () => {
    this.setState({ loadingSkills: true, error: null });

    try {
      const res = await api.get("/skills");
      this.setState({
        skills: res.data || [],
        loadingSkills: false,
      });
    } catch (err) {
      this.setState({
        loadingSkills: false,
        error: safeErrors(err, "Failed to load skills").join(", "),
      });
    }
  };

  handleFieldChange = (e) => {
    this.setState({ [e.target.name]: e.target.value });
  };

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

  toggleAddSkill = (role, skill) => {
    this.setState((prev) => {
      const current = prev.draftSkillsByRole[role] || [];
      const exists = current.some((s) => s.id === skill.id);

      return {
        draftSkillsByRole: {
          ...prev.draftSkillsByRole,
          [role]: exists ? current : [...current, skill],
        },
        success: null,
        error: null,
      };
    });
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

  clearSection = (role) => {
    const notesKey =
      role === ROLE.WARMUP
        ? "warmupNotes"
        : role === ROLE.COOLDOWN
        ? "cooldownNotes"
        : "mainNotes";

    this.setState((prev) => ({
      draftSkillsByRole: {
        ...prev.draftSkillsByRole,
        [role]: [],
      },
      [notesKey]: "",
      skillSearchByRole: {
        ...prev.skillSearchByRole,
        [role]: "",
      },
      success: null,
      error: null,
    }));
  };

  clearAll = () => {
    this.setState({
      title: "",
      description: "",
      draftSkillsByRole: {
        main: [],
        warmup: [],
        cooldown: [],
      },
      warmupNotes: "",
      mainNotes: "",
      cooldownNotes: "",
      addSkillsOpenByRole: {
        main: true,
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
    });
  };

  scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(() => {
      if (typeof el.focus === "function") el.focus();
    }, 250);
  };

  createLessonPlan = async () => {
    const {
      title,
      description,
      warmupNotes,
      mainNotes,
      cooldownNotes,
      draftSkillsByRole,
    } = this.state;

    if (!(title || "").trim()) {
      this.setState({ error: "Title is required.", success: null });
      return;
    }

    this.setState({ saving: true, error: null, success: null });

    let lessonPlanId = null;

    try {
      const lpRes = await api.post("/lesson_plans", {
        lesson_plan: {
          title: (title || "").trim(),
          description: (description || "").trim(),
          warmup_notes: (warmupNotes || "").trim(),
          main_notes: (mainNotes || "").trim(),
          cooldown_notes: (cooldownNotes || "").trim(),
        },
      });

      lessonPlanId = lpRes.data?.id;

      const payloadV2 = {
        warmup_skill_ids: (draftSkillsByRole.warmup || []).map((s) => s.id),
        skill_ids: (draftSkillsByRole.main || []).map((s) => s.id),
        cooldown_skill_ids: (draftSkillsByRole.cooldown || []).map((s) => s.id),
      };

      await api.post(`/lesson_plans/${lessonPlanId}/add_skills`, payloadV2);

      this.setState({ saving: false });
      this.props.navigate(`/lesson-plans/${lessonPlanId}`);
    } catch (err) {
      const isAddSkillsFail =
        typeof err?.config?.url === "string" && err.config.url.includes("/add_skills");

      if (lessonPlanId && isAddSkillsFail) {
        try {
          const legacy = Array.from(
            new Set([
              ...(draftSkillsByRole.warmup || []).map((s) => s.id),
              ...(draftSkillsByRole.main || []).map((s) => s.id),
              ...(draftSkillsByRole.cooldown || []).map((s) => s.id),
            ])
          );

          await api.post(`/lesson_plans/${lessonPlanId}/add_skills`, {
            skill_ids: legacy,
          });

          this.setState({ saving: false });
          this.props.navigate(`/lesson-plans/${lessonPlanId}`);
          return;
        } catch (err2) {
          this.setState({
            saving: false,
            error: safeErrors(err2, "Failed to add skills").join(", "),
          });
          return;
        }
      }

      this.setState({
        saving: false,
        error: safeErrors(err, "Failed to create lesson plan").join(", "),
      });
    }
  };

  renderSectionCard = ({ title, role, skills, notes, searchQuery, addSkillsOpen, allSkills }) => {
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

          <div className="mb-3">
            <div className="d-flex justify-content-center gap-2 flex-wrap">
              <Button
                size="sm"
                className={BTN_CLASS}
                style={BTN_STYLE}
                variant={addSkillsOpen ? "secondary" : "outline-secondary"}
                onClick={() => this.toggleAddSkillsOpen(role)}
                disabled={this.state.saving}
                aria-expanded={addSkillsOpen}
                aria-controls={`add-skills-panel-${role}`}
              >
                {addSkillsOpen ? "Hide" : "Add Skills"}
              </Button>

              <Button
                size="sm"
                className={BTN_CLASS}
                style={BTN_STYLE}
                variant="outline-secondary"
                onClick={() => this.clearSection(role)}
                disabled={this.state.saving && skills.length === 0 && !notes}
              >
                Clear section
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
                      onChange={(e) => this.changeSkillSearch(role, e.target.value)}
                      disabled={this.state.saving}
                      style={{ borderRadius: 12 }}
                    />
                    <Button
                      size="sm"
                      className={BTN_CLASS}
                      style={BTN_STYLE}
                      variant="outline-secondary"
                      onClick={() => this.clearSkillSearch(role)}
                      disabled={this.state.saving || !searchQuery}
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
                  {this.state.loadingSkills ? (
                    <p className="text-muted mb-0">Loading skills…</p>
                  ) : availableSkillsRaw.length === 0 ? (
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
                            <div
                              key={`${role}-available-${skill.id}`}
                              className="border rounded-3 px-3 py-2 d-flex justify-content-between align-items-start gap-2 mb-2"
                              style={{
                                background: "#fff",
                                borderColor: "#e9ecef",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, lineHeight: 1.35 }}>
                                  <strong>Basic {skill.level}</strong> — {skill.name}
                                </div>
                              </div>

                              <Button
                                size="sm"
                                className={`${BTN_CLASS} flex-shrink-0`}
                                style={BTN_STYLE}
                                variant="outline-primary"
                                onClick={() => this.toggleAddSkill(role, skill)}
                                disabled={this.state.saving}
                              >
                                Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mb-3">
            <div className="fw-semibold mb-2" style={{ fontSize: 14 }}>
              Skills
            </div>

            {skills.length === 0 ? (
              <SectionEmpty>No {title.toLowerCase()} skills added yet.</SectionEmpty>
            ) : (
              <div className="d-grid" style={{ gap: 8 }}>
                {sortSkills(skills).map((skill) => (
                  <div
                    key={`${role}-skill-${skill.id}`}
                    className="border rounded-3 px-3 py-2 d-flex justify-content-between align-items-start gap-2"
                    style={{
                      background: "#fff",
                      borderColor: "#e9ecef",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, lineHeight: 1.35 }}>
                        <strong>Basic {skill.level}</strong> — {skill.name}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline-danger"
                      className={`${BTN_CLASS} flex-shrink-0`}
                      style={BTN_STYLE}
                      onClick={() => this.removeSkill(role, skill.id)}
                      disabled={this.state.saving}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="fw-semibold mb-2" style={{ fontSize: 14 }}>
              Notes
            </div>

            <Form.Control
              as="textarea"
              rows={4}
              value={notes || ""}
              onChange={(e) => {
                const key =
                  role === ROLE.WARMUP
                    ? "warmupNotes"
                    : role === ROLE.COOLDOWN
                    ? "cooldownNotes"
                    : "mainNotes";
                this.setState({ [key]: e.target.value });
              }}
              disabled={this.state.saving}
              placeholder={`Add notes for ${title.toLowerCase()}…`}
              style={{ borderRadius: 12 }}
            />
          </div>
        </Card.Body>
      </Card>
    );
  };

  render() {
    const {
      title,
      description,
      skills,
      draftSkillsByRole,
      addSkillsOpenByRole,
      skillSearchByRole,
      saving,
      error,
      success,
      warmupNotes,
      mainNotes,
      cooldownNotes,
    } = this.state;

    const warmupSkills = draftSkillsByRole.warmup || [];
    const mainSkills = draftSkillsByRole.main || [];
    const cooldownSkills = draftSkillsByRole.cooldown || [];

    const totalSkills = warmupSkills.length + mainSkills.length + cooldownSkills.length;
    const hasAnyContent =
      !!title.trim() ||
      !!description.trim() ||
      totalSkills > 0 ||
      !!warmupNotes.trim() ||
      !!mainNotes.trim() ||
      !!cooldownNotes.trim();

    const tocItems = [
      { id: "lesson-overview", label: "Overview" },
      { id: "section-warmup", label: `Warm-up (${warmupSkills.length})` },
      { id: "section-main", label: `Main Lesson (${mainSkills.length})` },
      { id: "section-cooldown", label: `Cool-down (${cooldownSkills.length})` },
    ];

    return (
      <div className="container mt-4" style={{ maxWidth: 1100 }}>
        {success ? <Alert variant="success">{success}</Alert> : null}
        {error ? <Alert variant="danger">{error}</Alert> : null}

        <div className="mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <a
              href="/lesson-plans"
              className="text-decoration-none"
              onClick={(e) => {
                e.preventDefault();
                this.props.navigate("/lesson-plans");
              }}
            >
              ← Back to lesson plans
            </a>
          </div>

          <div className="d-flex gap-2 flex-wrap align-items-center">
            <Button
              size="sm"
              variant="outline-secondary"
              className={BTN_CLASS}
              style={BTN_STYLE}
              onClick={this.clearAll}
              disabled={saving || !hasAnyContent}
            >
              Clear
            </Button>

            <Button
              size="sm"
              variant="primary"
              className={BTN_CLASS}
              style={BTN_STYLE}
              onClick={this.createLessonPlan}
              disabled={saving || !title.trim()}
            >
              {saving ? "Creating..." : "Create Lesson Plan"}
            </Button>
          </div>
        </div>

        <div id="lesson-overview" tabIndex="-1">
          <Card className="mb-4 border-0 shadow-sm" style={{ borderRadius: 18 }}>
            <Card.Body className="p-4">
              <div className="d-flex flex-column flex-xl-row gap-4 align-items-start">
                <div style={{ flex: 1, minWidth: 0, maxWidth: 760 }}>
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <SectionKicker>Lesson Plan Builder</SectionKicker>
                    <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
                  </div>

                  <div className="text-muted mb-4" style={{ fontSize: 13, lineHeight: 1.5 }}>
                    Create the lesson title and description here, then build out each section below
                    with skills and notes.
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

                  <div
                    className="mt-3 pt-3"
                    style={{ borderTop: "1px solid #e9ecef", fontSize: 13 }}
                  >
                    <div className="text-muted mb-1">Selected skills</div>
                    <div className="fw-semibold">{totalSkills}</div>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>

        <div id="section-warmup" tabIndex="-1">
          {this.renderSectionCard({
            title: "Warm-up",
            role: ROLE.WARMUP,
            skills: warmupSkills,
            notes: warmupNotes,
            searchQuery: skillSearchByRole.warmup,
            addSkillsOpen: addSkillsOpenByRole.warmup,
            allSkills: skills,
          })}
        </div>

        <div id="section-main" tabIndex="-1">
          {this.renderSectionCard({
            title: "Main Lesson",
            role: ROLE.MAIN,
            skills: mainSkills,
            notes: mainNotes,
            searchQuery: skillSearchByRole.main,
            addSkillsOpen: addSkillsOpenByRole.main,
            allSkills: skills,
          })}
        </div>

        <div id="section-cooldown" tabIndex="-1">
          {this.renderSectionCard({
            title: "Cool-down",
            role: ROLE.COOLDOWN,
            skills: cooldownSkills,
            notes: cooldownNotes,
            searchQuery: skillSearchByRole.cooldown,
            addSkillsOpen: addSkillsOpenByRole.cooldown,
            allSkills: skills,
          })}
        </div>

        <div className="pb-4 d-flex justify-content-end">
          <Button
            variant="primary"
            className={BTN_CLASS}
            style={BTN_STYLE}
            onClick={this.createLessonPlan}
            disabled={saving || !title.trim()}
          >
            {saving ? "Creating..." : "Create Lesson Plan"}
          </Button>
        </div>
      </div>
    );
  }
}
