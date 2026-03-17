// src/components/StudentNew.js
import React, { Component } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

function withNav(Component) {
  return (props) => {
    const navigate = useNavigate();
    return <Component {...props} navigate={navigate} />;
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

class StudentNew extends Component {
  state = {
    first_name: "",
    last_name: "",
    email: "",
    birthday: "",
    notes: "",

    saving: false,
    error: null,
    success: null,
  };

  handleChange = (e) => this.setState({ [e.target.name]: e.target.value });

  clearForm = () => {
    this.setState({
      first_name: "",
      last_name: "",
      email: "",
      birthday: "",
      notes: "",
      error: null,
      success: null,
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

  submit = (e) => {
    e.preventDefault();

    const { first_name, last_name, email, birthday, notes } = this.state;

    this.setState({ saving: true, error: null, success: null });

    api
      .post("/students", {
        student: {
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email.trim() || null,
          birthday: birthday || null,
          notes: (notes || "").trim() || null,
        },
      })
      .then((res) => {
        const newStudent = res.data;
        this.props.navigate(`/students/${newStudent.id}`);
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to create student";

        this.setState({
          saving: false,
          error: msg,
        });
      });
  };

  render() {
    const { first_name, last_name, email, birthday, notes, saving, error } = this.state;

    const fullNamePreview = [first_name, last_name].filter(Boolean).join(" ").trim();
    const hasAnyContent =
      !!first_name.trim() ||
      !!last_name.trim() ||
      !!email.trim() ||
      !!birthday ||
      !!notes.trim();

    const tocItems = [
      { id: "student-overview", label: "Overview" },
      { id: "student-details", label: "Student Details" },
      { id: "student-notes", label: "Notes" },
    ];

    return (
      <div className="container mt-4" style={{ maxWidth: 1100 }}>
        {error ? <Alert variant="danger">{error}</Alert> : null}

        <div className="mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <a
              href="/students"
              className="text-decoration-none"
              onClick={(e) => {
                e.preventDefault();
                this.props.navigate("/students");
              }}
            >
              ← Back to students
            </a>
          </div>

          <div className="d-flex gap-2 flex-wrap align-items-center">
            <Button
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
              size="sm"
              variant="primary"
              className={BTN_CLASS}
              style={BTN_STYLE}
              onClick={this.submit}
              disabled={saving || !first_name.trim() || !last_name.trim()}
            >
              {saving ? "Saving..." : "Create Student"}
            </Button>
          </div>
        </div>

        <div id="student-overview" tabIndex="-1">
          <Card className="mb-4 border-0 shadow-sm" style={{ borderRadius: 18 }}>
            <Card.Body className="p-4">
              <div className="d-flex flex-column flex-xl-row gap-4 align-items-start">
                <div style={{ flex: 1, minWidth: 0, maxWidth: 760 }}>
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <SectionKicker>Student Builder</SectionKicker>
                    <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
                  </div>

                  <div className="text-muted mb-4" style={{ fontSize: 13, lineHeight: 1.5 }}>
                    Add the student’s basic information here, then include any notes you want to keep
                    for future lessons.
                  </div>

                  <Card.Title
                    className="mb-2"
                    style={{
                      fontSize: "1.85rem",
                      lineHeight: 1.15,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {fullNamePreview || "New Student"}
                  </Card.Title>

                  <div className="text-muted" style={{ fontSize: 14 }}>
                    {email?.trim()
                      ? email
                      : birthday
                      ? `Birthday: ${birthday}`
                      : "No contact details added yet."}
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
                    <div className="text-muted mb-1">Required fields</div>
                    <div className="fw-semibold">First + last name</div>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>

        <Form onSubmit={this.submit}>
          <div id="student-details" tabIndex="-1">
            <Card className="mb-3 border-0 shadow-sm">
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <SectionKicker>Student Details</SectionKicker>
                  <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
                </div>

                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold">First name</Form.Label>
                      <Form.Control
                        name="first_name"
                        value={first_name}
                        onChange={this.handleChange}
                        disabled={saving}
                        required
                        placeholder="First name"
                        style={{ borderRadius: 12 }}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold">Last name</Form.Label>
                      <Form.Control
                        name="last_name"
                        value={last_name}
                        onChange={this.handleChange}
                        disabled={saving}
                        required
                        placeholder="Last name"
                        style={{ borderRadius: 12 }}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold">Email</Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        value={email}
                        onChange={this.handleChange}
                        disabled={saving}
                        placeholder="student@example.com"
                        style={{ borderRadius: 12 }}
                      />
                      <div className="form-text">Optional</div>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold">Birthday</Form.Label>
                      <Form.Control
                        type="date"
                        name="birthday"
                        value={birthday}
                        onChange={this.handleChange}
                        disabled={saving}
                        style={{ borderRadius: 12 }}
                      />
                      <div className="form-text">Optional</div>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </div>

          <div id="student-notes" tabIndex="-1">
            <Card className="mb-3 border-0 shadow-sm">
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <SectionKicker>Notes</SectionKicker>
                  <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
                </div>

                <Form.Group>
                  <Form.Label className="fw-semibold">Notes</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={5}
                    name="notes"
                    value={notes}
                    onChange={this.handleChange}
                    disabled={saving}
                    placeholder="Anything you want to remember about this student…"
                    style={{ borderRadius: 12 }}
                  />
                  <div className="form-text">
                    Optional notes for goals, preferences, reminders, or context.
                  </div>
                </Form.Group>
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
              disabled={saving || !first_name.trim() || !last_name.trim()}
            >
              {saving ? "Saving..." : "Create Student"}
            </Button>
          </div>
        </Form>
      </div>
    );
  }
}

export default withNav(StudentNew);