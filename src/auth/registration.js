import React, { Component } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";

const API_BASE = process.env.REACT_APP_API_BASE_URL;

const SectionKicker = ({ children }) => (
  <div
    className="text-uppercase text-muted"
    style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8 }}
  >
    {children}
  </div>
);

export default class Registration extends Component {
  constructor(props) {
    super(props);

    this.state = {
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      password_confirmation: "",
      role: "student",
      registrationErrors: []
    };

    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

 handleSubmit(event) {
  event.preventDefault();

  axios
    .post(`${API_BASE}/registrations`, {
      user: {
        first_name: this.state.first_name.trim(),
        last_name: this.state.last_name.trim(),
        email: this.state.email.trim().toLowerCase(),
        password: this.state.password,
        password_confirmation: this.state.password_confirmation,
        role: this.state.role
      }
    })
    .then((response) => {
      const { user, token, errors } = response.data || {};

      if (user && token) {
        localStorage.setItem("authToken", token);
        this.setState({ registrationErrors: [] });
        this.props.handleSuccessfulAuth({ user, token });
        return;
      }

      this.setState({
        registrationErrors: errors || ["Registration failed"]
      });
    })
    .catch((error) => {
      const msg =
        error?.response?.data?.errors ||
        [error?.response?.data?.error] ||
        [error.message || "Registration failed"];

      this.setState({ registrationErrors: msg });
    });
}


  handleChange(event) {
    this.setState({ [event.target.name]: event.target.value });
  }

  render() {
    const { registrationErrors } = this.state;

    return (
      <div className="container" style={{ maxWidth: 520, marginTop: 28 }}>
        <Card style={{ borderRadius: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
          <Card.Body style={{ padding: 18 }}>
            <div className="mb-2">
              <SectionKicker>Welcome</SectionKicker>
            </div>

            <div
              className="fw-semibold"
              style={{ fontSize: "clamp(18px, 4.6vw, 22px)", letterSpacing: -0.2 }}
            >
              Create your account
            </div>

            <div className="text-muted mt-1" style={{ fontSize: 13 }}>
              Choose your role and enter your details to get started.
            </div>

            {registrationErrors?.length > 0 && (
              <Alert variant="danger" className="mt-3 mb-0">
                <ul className="mb-0" style={{ paddingLeft: 18 }}>
                  {registrationErrors.map((err, idx) => (
                    <li key={idx}>{String(err)}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <Form className="mt-3" onSubmit={this.handleSubmit}>
            
              <div className="d-grid d-md-flex" style={{ gap: 12 }}>
                <Form.Group className="mb-3 flex-grow-1">
                  <Form.Label style={{ fontSize: 12, fontWeight: 700 }}>
                    First name
                  </Form.Label>
                  <Form.Control
                    name="first_name"
                    value={this.state.first_name}
                    onChange={this.handleChange}
                    required
                    placeholder="First name"
                    style={{ borderRadius: 12 }}
                  />
                </Form.Group>

                <Form.Group className="mb-3 flex-grow-1">
                  <Form.Label style={{ fontSize: 12, fontWeight: 700 }}>
                    Last name
                  </Form.Label>
                  <Form.Control
                    name="last_name"
                    value={this.state.last_name}
                    onChange={this.handleChange}
                    required
                    placeholder="Last name"
                    style={{ borderRadius: 12 }}
                  />
                </Form.Group>
              </div>

              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 12, fontWeight: 700 }}>
                  Email
                </Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={this.state.email}
                  onChange={this.handleChange}
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  style={{ borderRadius: 12 }}
                />
              </Form.Group>

              <div className="d-grid d-md-flex" style={{ gap: 12 }}>
                <Form.Group className="mb-3 flex-grow-1">
                  <Form.Label style={{ fontSize: 12, fontWeight: 700 }}>
                    Password
                  </Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={this.state.password}
                    onChange={this.handleChange}
                    required
                    placeholder="Create password"
                    autoComplete="new-password"
                    style={{ borderRadius: 12 }}
                  />
                </Form.Group>

                <Form.Group className="mb-3 flex-grow-1">
                  <Form.Label style={{ fontSize: 12, fontWeight: 700 }}>
                    Confirm
                  </Form.Label>
                  <Form.Control
                    type="password"
                    name="password_confirmation"
                    value={this.state.password_confirmation}
                    onChange={this.handleChange}
                    required
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    style={{ borderRadius: 12 }}
                  />
                </Form.Group>
              </div>

              <div className="d-flex align-items-center gap-2 mt-1">
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  className="rounded-pill px-3"
                  style={{ fontSize: 12 }}
                >
                  Register
                </Button>

                <div className="text-muted" style={{ fontSize: 12 }}>
                  Already have an account?{" "}
                  <Link to="/" className="text-decoration-none fw-semibold">
                    Log in
                  </Link>
                </div>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </div>
    );
  }
}
