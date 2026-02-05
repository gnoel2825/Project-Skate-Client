import React, { Component } from "react";
import Login from "../auth/login";
import { Link } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";

export default class Home extends Component {
  constructor(props) {
    super(props);
    this.handleSuccessfulAuth = this.handleSuccessfulAuth.bind(this);
  }

  handleSuccessfulAuth(data) {
    this.props.handleLogin(data);
    this.props.navigate("/dashboard");
  }

  render() {
    const isLoggedIn =
      String(this.props.loggedInStatus || "").toLowerCase() === "logged_in";

    return (
      <Container className="py-5">
        <Row className="justify-content-center">
          <Col xs={12} sm={10} md={7} lg={5} xl={4}>
            {/* Optional: show status neatly instead of two <h1>s */}
            {isLoggedIn ? (
              <Alert variant="success" className="mb-3">
                You’re already logged in.{" "}
                <Link to="/dashboard" className="text-decoration-none">
                  Go to dashboard →
                </Link>
              </Alert>
            ) : null}

            <Card className="shadow-sm" style={{ borderRadius: 16 }}>
              <Card.Body className="p-4">
                <div className="text-center mb-3">
                  <div
                    className="mx-auto mb-3 d-flex align-items-center justify-content-center"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "#f1f3f5",
                      fontWeight: 800
                    }}
                    aria-hidden="true"
                  >
                    ⛸️
                  </div>

                  <h1 className="h4 mb-1">Welcome back!</h1>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    Log in to manage your rosters, schedules, and lesson plans.
                  </div>
                </div>

                {/* Your existing Login form */}
                <div className="auth-form">
                <Login handleSuccessfulAuth={this.handleSuccessfulAuth} />
                </div>

                <div className="d-flex align-items-center gap-2 my-3">
                  <div style={{ height: 1, background: "#e9ecef", flex: 1 }} />
                  <div className="text-muted text-uppercase" style={{ fontSize: 11, letterSpacing: 0.6 }}>
                    or
                  </div>
                  <div style={{ height: 1, background: "#e9ecef", flex: 1 }} />
                </div>

                <div className="text-center" style={{ fontSize: 14 }}>
                  Don’t have an account?{" "}
                  <Link to="/registration" className="text-decoration-none fw-semibold">
                    Register
                  </Link>
                </div>
              </Card.Body>
            </Card>

            <div className="text-center text-muted mt-3" style={{ fontSize: 12 }}>
              Status: {this.props.loggedInStatus}
            </div>
          </Col>
        </Row>
      </Container>
    );
  }
}
