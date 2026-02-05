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

const API_BASE = process.env.REACT_APP_API_BASE_URL;


function withNav(Component) {
  return (props) => {
    const navigate = useNavigate();
    return <Component {...props} navigate={navigate} />;
  };
}

class StudentNew extends Component {
  state = {
    first_name: "",
    last_name: "",
    email: "",
    birthday: "", // YYYY-MM-DD
    notes: "",

    saving: false,
    error: null,
    success: null
  };

  handleChange = (e) => this.setState({ [e.target.name]: e.target.value });

  submit = (e) => {
    e.preventDefault();

    const { first_name, last_name, email, birthday, notes } = this.state;

    this.setState({ saving: true, error: null, success: null });

    api
      .post(
        `/students`,
        {
          student: {
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: email.trim() || null,
            birthday: birthday || null,
            notes: (notes || "").trim() || null
          }
        }
      )
      .then((res) => {
        const newStudent = res.data;
        // go to student view page
        this.props.navigate(`/students/${newStudent.id}`);
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to create student";
        this.setState({ saving: false, error: msg });
      });
  };

  render() {
    const { first_name, last_name, email, birthday, notes, saving, error } = this.state;

    return (
      <div className="container mt-4" style={{ maxWidth: 900 }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h1 className="mb-0">Add Student</h1>
          <Button variant="outline-secondary" className="" style={{ fontSize: 12}} onClick={() => this.props.navigate(-1)}>
            Back
          </Button>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Card>
          <Card.Body>
            <Form onSubmit={this.submit}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Label>First name</Form.Label>
                  <Form.Control
                    name="first_name"
                    value={first_name}
                    onChange={this.handleChange}
                    disabled={saving}
                    required
                  />
                </Col>

                <Col md={6}>
                  <Form.Label>Last name</Form.Label>
                  <Form.Control
                    name="last_name"
                    value={last_name}
                    onChange={this.handleChange}
                    disabled={saving}
                    required
                  />
                </Col>

                <Col md={6}>
                  <Form.Label>Email (optional)</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={email}
                    onChange={this.handleChange}
                    disabled={saving}
                    placeholder="student@example.com"
                  />
                </Col>

                <Col md={6}>
                  <Form.Label>Birthday (optional)</Form.Label>
                  <Form.Control
                    type="date"
                    name="birthday"
                    value={birthday}
                    onChange={this.handleChange}
                    disabled={saving}
                  />
                </Col>

                <Col md={12}>
                  <Form.Label>Notes (optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    name="notes"
                    value={notes}
                    onChange={this.handleChange}
                    disabled={saving}
                    placeholder="Anything you want to remember about this student…"
                  />
                </Col>
              </Row>

              <div className="d-flex gap-2 mt-3">
                <Button type="submit" style={{ fontSize: 12}} size="sm"
                className="rounded-pill px-3" variant="primary" disabled={saving}>
                  {saving ? "Saving..." : "Create student"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                className="rounded-pill px-3"
                  variant="outline-secondary"
                  disabled={saving}
                  onClick={() =>
                    this.setState({
                      first_name: "",
                      last_name: "",
                      email: "",
                      birthday: "",
                      notes: ""
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

export default withNav(StudentNew);
