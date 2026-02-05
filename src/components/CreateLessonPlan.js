import React, { Component } from "react";
import axios from "axios";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Card from "react-bootstrap/Card";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Badge from "react-bootstrap/Badge";
import { useSearchParams, useNavigate } from "react-router-dom";

/* ======================================================
   Wrapper component (hooks live here)
====================================================== */
function CreateLessonPlanWithNavAndQuery(props) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dateParam = searchParams.get("date"); // YYYY-MM-DD (optional)

  return <CreateLessonPlan {...props} dateParam={dateParam} navigate={navigate} />;
}

export default CreateLessonPlanWithNavAndQuery;

const API_BASE = process.env.REACT_APP_API_BASE_URL;


/* ======================================================
   Helpers
====================================================== */
const ROLE = {
  MAIN: "main",
  WARMUP: "warmup",
  COOLDOWN: "cooldown",
};

const ROLE_LABEL = (role) => {
  if (role === ROLE.WARMUP) return "Warm-up";
  if (role === ROLE.COOLDOWN) return "Cool-down";
  return "Main Lesson";
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < (arr || []).length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const safeErrors = (err, fallback) => {
  const raw =
    err?.response?.data?.errors ||
    err?.response?.data?.error ||
    err?.message ||
    fallback;
  return Array.isArray(raw) ? raw : [String(raw)];
};

/* ======================================================
   Class component
====================================================== */
class CreateLessonPlan extends Component {
  state = {
    // details
    title: "",
    description: "",

    // skills
    skills: [],
    warmupSkillIds: new Set(),
    mainSkillIds: new Set(),
    cooldownSkillIds: new Set(),

    // notes
    warmupNotes: "",
    mainNotes: "",
    cooldownNotes: "",

    // ui
    activeRole: ROLE.MAIN,
    loadingSkills: false,
    submitting: false,
    errors: [],
    success: null,
  };

  componentDidMount() {
    this.fetchSkills();
  }

  fetchSkills = () => {
    this.setState({ loadingSkills: true, errors: [], success: null });

    axios
      .get(`${API_BASE}/skills`, { withCredentials: true })
      .then((res) => this.setState({ skills: res.data || [], loadingSkills: false }))
      .catch((err) =>
        this.setState({
          loadingSkills: false,
          errors: safeErrors(err, "Failed to load skills"),
        })
      );
  };

  handleChange = (e) => this.setState({ [e.target.name]: e.target.value });

  getSelectedSetForRole = (role) => {
    if (role === ROLE.WARMUP) return this.state.warmupSkillIds;
    if (role === ROLE.COOLDOWN) return this.state.cooldownSkillIds;
    return this.state.mainSkillIds;
  };

  setSelectedSetForRole = (role, nextSet) => {
    if (role === ROLE.WARMUP) return this.setState({ warmupSkillIds: nextSet });
    if (role === ROLE.COOLDOWN) return this.setState({ cooldownSkillIds: nextSet });
    return this.setState({ mainSkillIds: nextSet });
  };

  getNotesKeyForRole = (role) => {
    if (role === ROLE.WARMUP) return "warmupNotes";
    if (role === ROLE.COOLDOWN) return "cooldownNotes";
    return "mainNotes";
  };

  toggleSkill = (role, skillId) => {
    const current = this.getSelectedSetForRole(role);
    const next = new Set(current);
    if (next.has(skillId)) next.delete(skillId);
    else next.add(skillId);
    this.setSelectedSetForRole(role, next);
  };

  groupByLevel = (skills) => {
    return (skills || []).reduce((acc, s) => {
      const level = s.level ?? 0;
      if (!acc[level]) acc[level] = [];
      acc[level].push(s);
      return acc;
    }, {});
  };

  // ✅ ONE STEP: create lesson plan (details + notes) THEN add skills THEN navigate
  createOneStep = async (e) => {
    e.preventDefault();

    const title = (this.state.title || "").trim();
    const description = (this.state.description || "").trim();
    if (!title) return this.setState({ errors: ["Title is required."] });

    this.setState({ submitting: true, errors: [], success: null });

    let lessonPlanId = null;

    try {
      // 1) Create plan (includes notes)
      const lpRes = await axios.post(
        `${API_BASE}/lesson_plans`,
        {
          lesson_plan: {
            title,
            description,
            warmup_notes: this.state.warmupNotes,
            main_notes: this.state.mainNotes,
            cooldown_notes: this.state.cooldownNotes,
          },
        },
        { withCredentials: true }
      );

      lessonPlanId = lpRes.data?.id;

      // 2) Add skills (v2)
      const payloadV2 = {
        warmup_skill_ids: Array.from(this.state.warmupSkillIds),
        skill_ids: Array.from(this.state.mainSkillIds),
        cooldown_skill_ids: Array.from(this.state.cooldownSkillIds),
      };

      await axios.post(
        `${API_BASE}/lesson_plans/${lessonPlanId}/add_skills`,
        payloadV2,
        { withCredentials: true }
      );

      // 3) Navigate
      this.setState({ submitting: false });
      this.props.navigate(`/lesson-plans/${lessonPlanId}`);
    } catch (err) {
      // Fallback: if add_skills v2 fails, try legacy payload (combine)
      const isAddSkillsFail =
        typeof err?.config?.url === "string" && err.config.url.includes("/add_skills");

      if (lessonPlanId && isAddSkillsFail) {
        try {
          const legacy = Array.from(
            new Set([
              ...Array.from(this.state.warmupSkillIds),
              ...Array.from(this.state.mainSkillIds),
              ...Array.from(this.state.cooldownSkillIds),
            ])
          );

          await axios.post(
            `${API_BASE}/lesson_plans/${lessonPlanId}/add_skills`,
            { skill_ids: legacy },
            { withCredentials: true }
          );

          this.setState({ submitting: false });
          this.props.navigate(`/lesson-plans/${lessonPlanId}`);
          return;
        } catch (err2) {
          this.setState({
            submitting: false,
            errors: safeErrors(err2, "Failed to add skills"),
          });
          return;
        }
      }

      this.setState({
        submitting: false,
        errors: safeErrors(err, "Failed to create lesson plan"),
      });
    }
  };

  clearRole = (role) => {
    this.setSelectedSetForRole(role, new Set());
    const notesKey = this.getNotesKeyForRole(role);
    this.setState({ [notesKey]: "" });
  };

  clearAll = () => {
    this.setState({
      warmupSkillIds: new Set(),
      mainSkillIds: new Set(),
      cooldownSkillIds: new Set(),
      warmupNotes: "",
      mainNotes: "",
      cooldownNotes: "",
    });
  };

  render() {
    const {
      title,
      description,
      skills,
      warmupSkillIds,
      mainSkillIds,
      cooldownSkillIds,
      activeRole,
      loadingSkills,
      submitting,
      errors,
      success,
    } = this.state;

    const totalSelected = warmupSkillIds.size + mainSkillIds.size + cooldownSkillIds.size;

    const grouped = this.groupByLevel(skills);
    const levels = Object.keys(grouped)
      .map(Number)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    const selectedSet = this.getSelectedSetForRole(activeRole);
    const notesKey = this.getNotesKeyForRole(activeRole);

    // Keep mobile from feeling like an endless page:
    // - Skills list scrolls inside card.
    // - Buttons wrap.
    const maxListHeight = 420;

    const canSubmit = !submitting && !!(title || "").trim();

    return (
      <div className="container mt-4" style={{ maxWidth: 1000 }}>
        {/* Header (mobile-friendly) */}
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
          <h1 className="mb-0">Create Lesson Plan</h1>

          <div className="d-flex gap-2 flex-wrap">
            <Button
              variant="primary"
              onClick={this.createOneStep}
              disabled={!canSubmit}
            >
              {submitting ? "Creating..." : "Create lesson plan"}
            </Button>

            <Button
              variant="outline-secondary"
              onClick={this.clearAll}
              disabled={submitting || (totalSelected === 0 && !this.state.warmupNotes && !this.state.mainNotes && !this.state.cooldownNotes)}
            >
              Clear all
            </Button>
          </div>
        </div>

        {success && <Alert variant="success">{success}</Alert>}

        {errors.length > 0 && (
          <Alert variant="danger">
            <ul className="mb-0">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* ONE STEP FORM: details + skills */}
        <Form onSubmit={this.createOneStep}>
          <Row className="g-3">
            {/* Details */}
           {/* Details */}
<Col lg={5}>
  <Card className="mb-3 mb-lg-0">
    <Card.Body>
      <Card.Title className="mb-3">Details</Card.Title>

      <Form.Group className="mb-3">
        <Form.Label>Title</Form.Label>
        <Form.Control
          name="title"
          value={title}
          onChange={this.handleChange}
          required
          disabled={submitting}
          placeholder="e.g. Basic Edges + One-foot Glides"
        />
      </Form.Group>

      <Form.Group className="mb-2">
        <Form.Label>Description</Form.Label>
        <Form.Control
          as="textarea"
          rows={4}
          name="description"
          value={description}
          onChange={this.handleChange}
          disabled={submitting}
          placeholder="Optional: goals, focus points, reminders…"
        />
      </Form.Group>

      <div className="text-muted" style={{ fontSize: 13 }}>
        Tip: Use the tabs on the right to add Warm-up / Main / Cool-down skills and notes.
      </div>

      {/* Mobile: put submit button here too */}
      <div className="d-grid d-sm-none mt-3">
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {submitting ? "Creating..." : "Create lesson plan"}
        </Button>
      </div>
    </Card.Body>
  </Card>
</Col>

            {/* Skills + Notes */}
            <Col lg={7}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                    <span>Skills</span>
                  </Card.Title>

                  {/* Role toggle */}
                  {/* Role toggle buttons (labels include selected counts) */}
<div className="d-flex gap-2 mt-2 flex-wrap">
  {[
    { key: "warmup", label: `Warm-up (${warmupSkillIds.size})` },
    { key: "main", label: `Main (${mainSkillIds.size})` },
    { key: "cooldown", label: `Cool-down (${cooldownSkillIds.size})` },
  ].map(({ key, label }) => (
    <Button
      key={key}
      size="sm"
      variant={this.state.activeRole === key ? "primary" : "outline-secondary"}
      onClick={() => this.setState({ activeRole: key })}
      disabled={submitting}
    >
      {label}
    </Button>
  ))}
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => this.clearRole(activeRole)}
                      disabled={submitting && selectedSet.size === 0 && !this.state[notesKey]}
                      style={{ marginLeft: "auto" }}
                    >
                      Clear this section
                    </Button>
                  </div>

                  {/* Active section header */}
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <div className="fw-semibold">{ROLE_LABEL(activeRole)}</div>
                    <div className="text-muted" style={{ fontSize: 13 }}>
                      {selectedSet.size} selected
                    </div>
                  </div>

                  {loadingSkills ? (
                    <p className="mt-3">Loading skills…</p>
                  ) : levels.length === 0 ? (
                    <p className="text-muted mt-3 mb-0">No skills available.</p>
                  ) : (
                    <div
                      className="mt-2"
                      style={{
                        maxHeight: maxListHeight,
                        overflowY: "auto",
                        border: "1px solid rgba(0,0,0,0.075)",
                        borderRadius: 8,
                        padding: 10,
                      }}
                    >
                      {levels.map((level) => {
                        const list = (grouped[level] || []).slice().sort((a, b) =>
                          (a.name || "").localeCompare(b.name || "")
                        );

                        // Optional: chunk into 2 columns on md+ for readability
                        const cols = chunk(list, Math.ceil(list.length / 2));

                        return (
                          <div key={`${activeRole}-${level}`} className="mb-3">
                            <div className="fw-semibold mb-2">Basic {level}</div>

                            <Row className="g-2">
                              {cols.map((colSkills, idx) => (
                                <Col key={`${activeRole}-${level}-${idx}`} xs={12} md={6}>
                                  {colSkills.map((skill) => (
                                    <Form.Check
                                      key={`${activeRole}-skill-${skill.id}`}
                                      id={`${activeRole}-skill-${skill.id}`}
                                      label={skill.name}
                                      checked={selectedSet.has(skill.id)}
                                      onChange={() => this.toggleSkill(activeRole, skill.id)}
                                      disabled={submitting}
                                      className="mb-2"
                                    />
                                  ))}
                                </Col>
                              ))}
                            </Row>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Notes box (changes with activeRole) */}
                  <Form.Group className="mt-3">
                    <Form.Label className="text-muted" style={{ fontSize: 12 }}>
                      Notes / custom skills for {ROLE_LABEL(activeRole)}
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={this.state[notesKey]}
                      onChange={(e) => this.setState({ [notesKey]: e.target.value })}
                      disabled={submitting}
                      placeholder="Add your own notes or custom skills…"
                    />
                  </Form.Group>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Form>
      </div>
    );
  }
}
