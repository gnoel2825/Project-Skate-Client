import React, { Component } from "react";
import api from "../api";
import { useParams, useNavigate } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Badge from "react-bootstrap/Badge";

function withRouter(Component) {
  return (props) => {
    const params = useParams();
    const navigate = useNavigate();
    return <Component {...props} params={params} navigate={navigate} />;
  };
}

const BTN_CLASS = "rounded-pill px-3";
const BTN_STYLE = { fontSize: 12 };

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

function fullName(student) {
  return [student?.first_name, student?.last_name].filter(Boolean).join(" ").trim();
}

function coerceStudents(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.students)) return data.students;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

class RosterForm extends Component {
  state = {
    loading: true,
    saving: false,
    error: null,
    success: null,

    name: "",
    selectedStudentIds: new Set(),
    originalStudentIds: new Set(),
    allStudents: [],
    query: "",
  };

  componentDidMount() {
    this.loadPage();
  }

  loadPage = async () => {
    const { id } = this.props.params;

    this.setState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      const studentsPromise = api.get("/students/all");
      const rosterPromise = id ? api.get(`/rosters/${id}`) : Promise.resolve(null);

      const [studentsRes, rosterRes] = await Promise.all([studentsPromise, rosterPromise]);

      const allStudents = coerceStudents(studentsRes?.data);
      const roster = rosterRes?.data || null;

      const selectedStudentIds = new Set(
        (roster?.students || []).map((student) => String(student.id))
      );

      this.setState({
        loading: false,
        allStudents,
        name: roster?.name || "",
        selectedStudentIds,
        originalStudentIds: new Set(selectedStudentIds),
      });
    } catch (err) {
      const msg =
        err.response?.data?.errors?.join(", ") ||
        err.response?.data?.error ||
        err.message ||
        "Failed to load roster form";

      this.setState({
        loading: false,
        error: msg,
      });
    }
  };

  handleNameChange = (e) => this.setState({ name: e.target.value });

  handleQueryChange = (e) => this.setState({ query: e.target.value });

  addStudent = (id) => {
    this.setState((prev) => {
      const next = new Set(prev.selectedStudentIds);
      next.add(String(id));
      return {
        selectedStudentIds: next,
        query: "",
        success: null,
        error: null,
      };
    });
  };

  removeStudent = (id) => {
    this.setState((prev) => {
      const next = new Set(prev.selectedStudentIds);
      next.delete(String(id));
      return {
        selectedStudentIds: next,
        success: null,
        error: null,
      };
    });
  };

  clearForm = () => {
    this.setState({
      name: "",
      selectedStudentIds: new Set(),
      query: "",
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

  handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();

    const { id } = this.props.params;
    const { name, selectedStudentIds, originalStudentIds } = this.state;

    this.setState({
      saving: true,
      error: null,
      success: null,
    });

    try {
      let rosterId = id;

      if (id) {
        await api.patch(`/rosters/${id}`, {
          roster: {
            name: (name || "").trim(),
          },
        });

        const currentIds = new Set(Array.from(selectedStudentIds).map(String));
        const originalIds = new Set(Array.from(originalStudentIds).map(String));

        const idsToAdd = Array.from(currentIds).filter((sid) => !originalIds.has(sid));
        const idsToRemove = Array.from(originalIds).filter((sid) => !currentIds.has(sid));

        for (const studentId of idsToAdd) {
          await api.post(`/rosters/${id}/add_student/${studentId}`, null);
        }

        for (const studentId of idsToRemove) {
          await api.delete(`/rosters/${id}/remove_student/${studentId}`);
        }

        this.setState({
          saving: false,
          success: "Roster updated!",
          originalStudentIds: new Set(currentIds),
        });
      } else {
        const res = await api.post(`/rosters`, {
          roster: {
            name: (name || "").trim(),
          },
        });

        rosterId = res.data?.id;

        if (rosterId) {
          for (const studentId of Array.from(selectedStudentIds)) {
            await api.post(`/rosters/${rosterId}/add_student/${studentId}`, null);
          }

          this.props.navigate(`/rosters/${rosterId}`);
          return;
        }

        this.setState({
          saving: false,
          success: "Roster created!",
        });
      }
    } catch (err) {
      const msg =
        err.response?.data?.errors?.join(", ") ||
        err.response?.data?.error ||
        err.message ||
        "Failed to save roster";

      this.setState({
        saving: false,
        error: msg,
      });
    }
  };

  render() {
    const { id } = this.props.params;
    const {
      loading,
      saving,
      error,
      success,
      name,
      selectedStudentIds,
      allStudents,
      query,
    } = this.state;

    if (loading) return <p className="m-4">Loading roster…</p>;

    const selectedStudents = allStudents
      .filter((student) => selectedStudentIds.has(String(student.id)))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));

    const availableStudents = allStudents
      .filter((student) => !selectedStudentIds.has(String(student.id)))
      .filter((student) => {
        if (!query.trim()) return true;
        const q = norm(query);
        return norm(fullName(student)).includes(q) || norm(student.email).includes(q);
      })
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));

    const hasAnyContent = !!name.trim() || selectedStudentIds.size > 0 || !!query.trim();

    const tocItems = [
      { id: "roster-overview", label: "Overview" },
      { id: "roster-details", label: "Roster details" },
      { id: "roster-students", label: `Students (${selectedStudents.length})` },
    ];

    return (
      <div className="container mt-4" style={{ maxWidth: 1100 }}>
        {success ? <Alert variant="success">{success}</Alert> : null}
        {error ? <Alert variant="danger">{error}</Alert> : null}

        <div className="mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <a
              href="/rosters"
              className="text-decoration-none"
              onClick={(e) => {
                e.preventDefault();
                this.props.navigate("/rosters");
              }}
            >
              ← Back to rosters
            </a>
          </div>

          <div className="d-flex gap-2 flex-wrap align-items-center">
            <Button
              type="button"
              size="sm"
              variant="outline-secondary"
              className={BTN_CLASS}
              style={BTN_STYLE}
              onClick={this.clearForm}
              disabled={saving || !hasAnyContent}
            >
              Clear
            </Button>

            <Button
              type="button"
              size="sm"
              variant="primary"
              className={BTN_CLASS}
              style={BTN_STYLE}
              onClick={this.handleSubmit}
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving..." : id ? "Save Changes" : "Create Roster"}
            </Button>
          </div>
        </div>

        <Form onSubmit={this.handleSubmit}>
          <div id="roster-overview" tabIndex="-1">
            <Card className="mb-4 border-0 shadow-sm" style={{ borderRadius: 18 }}>
              <Card.Body className="p-4">
                <div className="d-flex flex-column flex-xl-row gap-4 align-items-start">
                  <div style={{ flex: 1, minWidth: 0, maxWidth: 760 }}>
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <SectionKicker>Roster Builder</SectionKicker>
                      <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
                    </div>

                    <div className="text-muted mb-4" style={{ fontSize: 13, lineHeight: 1.5 }}>
                      {id
                        ? "Update the roster name and student list here."
                        : "Create a roster, then add students who belong in this group."}
                    </div>

                    <Card.Title
                      className="mb-2"
                      style={{
                        fontSize: "1.85rem",
                        lineHeight: 1.15,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {name.trim() || (id ? "Edit Roster" : "New Roster")}
                    </Card.Title>

                    <div className="text-muted" style={{ fontSize: 14 }}>
                      {selectedStudents.length === 0
                        ? "No students selected yet."
                        : `${selectedStudents.length} student${selectedStudents.length === 1 ? "" : "s"} selected`}
                    </div>
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
                          type="button"
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
                      <div className="text-muted mb-1">Roster size</div>
                      <div className="fw-semibold">{selectedStudents.length}</div>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </div>

          <div id="roster-details" tabIndex="-1">
            <Card className="mb-3 border-0 shadow-sm">
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <SectionKicker>Roster Details</SectionKicker>
                  <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
                </div>

                <Form.Group>
                  <Form.Label className="fw-semibold">Roster name</Form.Label>
                  <Form.Control
                    value={name}
                    onChange={this.handleNameChange}
                    placeholder="e.g. Sat 9am Basic 2"
                    disabled={saving}
                    required
                    style={{ borderRadius: 12 }}
                  />
                  <div className="form-text">
                    Use a clear name that makes it easy to identify this group at a glance.
                  </div>
                </Form.Group>
              </Card.Body>
            </Card>
          </div>

          <div id="roster-students" tabIndex="-1">
            <Card className="mb-3 border-0 shadow-sm">
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <SectionKicker>Students</SectionKicker>
                  <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
                  <Badge bg="light" text="dark" className="border" style={{ fontSize: 11 }}>
                    {selectedStudents.length}
                  </Badge>
                </div>

                <Row className="g-4">
                  <Col lg={6}>
                    <div className="fw-semibold mb-2" style={{ fontSize: 14 }}>
                      Selected students
                    </div>

                    {selectedStudents.length === 0 ? (
                      <div
                        className="text-muted border rounded-3 p-3"
                        style={{ background: "#fbfbfd", borderColor: "#e9ecef", fontSize: 14 }}
                      >
                        No students added yet.
                      </div>
                    ) : (
                      <div className="d-grid" style={{ gap: 8 }}>
                        {selectedStudents.map((student) => (
                          <div
                            key={student.id}
                            className="border rounded-3 px-3 py-2 d-flex justify-content-between align-items-start gap-2"
                            style={{
                              background: "#fff",
                              borderColor: "#e9ecef",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 14, lineHeight: 1.35 }}>
                                <strong>{fullName(student) || "Unnamed student"}</strong>
                              </div>

                              {student.email ? (
                                <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                                  {student.email}
                                </div>
                              ) : null}
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline-danger"
                              className={`${BTN_CLASS} flex-shrink-0`}
                              style={BTN_STYLE}
                              onClick={() => this.removeStudent(student.id)}
                              disabled={saving}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Col>

                  <Col lg={6}>
                    <div className="fw-semibold mb-2" style={{ fontSize: 14 }}>
                      Add students
                    </div>

                    <div className="mb-3">
                      <Form.Control
                        type="text"
                        placeholder="Search students by name or email…"
                        value={query}
                        onChange={this.handleQueryChange}
                        disabled={saving}
                        style={{ borderRadius: 12 }}
                      />
                    </div>

                    {availableStudents.length === 0 ? (
                      <div
                        className="text-muted border rounded-3 p-3"
                        style={{ background: "#fbfbfd", borderColor: "#e9ecef", fontSize: 14 }}
                      >
                        {query.trim()
                          ? "No students match that search."
                          : "No more students available to add."}
                      </div>
                    ) : (
                      <div
                        className="d-grid"
                        style={{
                          gap: 8,
                          maxHeight: 360,
                          overflowY: "auto",
                          paddingRight: 4,
                        }}
                      >
                        {availableStudents.map((student) => (
                          <div
                            key={student.id}
                            className="border rounded-3 px-3 py-2 d-flex justify-content-between align-items-start gap-2"
                            style={{
                              background: "#fff",
                              borderColor: "#e9ecef",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 14, lineHeight: 1.35 }}>
                                <strong>{fullName(student) || "Unnamed student"}</strong>
                              </div>

                              {student.email ? (
                                <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                                  {student.email}
                                </div>
                              ) : null}
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              className={`${BTN_CLASS} flex-shrink-0`}
                              style={BTN_STYLE}
                              variant="outline-primary"
                              onClick={() => this.addStudent(student.id)}
                              disabled={saving}
                            >
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </div>

          <div className="pb-4 d-flex justify-content-end gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline-secondary"
              className={BTN_CLASS}
              style={BTN_STYLE}
              onClick={this.clearForm}
              disabled={saving || !hasAnyContent}
            >
              Clear
            </Button>

            <Button
              type="submit"
              variant="primary"
              className={BTN_CLASS}
              style={BTN_STYLE}
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving..." : id ? "Save Changes" : "Create Roster"}
            </Button>
          </div>
        </Form>
      </div>
    );
  }
}

export default withRouter(RosterForm);
