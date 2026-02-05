import React, { Component } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE_URL;

export default class Login extends Component {
  constructor(props) {
    super(props);

    this.state = {
      email: "",
      password: "",
      loginErrors: ""
    };

    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

 handleSubmit(event) {
  event.preventDefault();

  const email = this.state.email.trim().toLowerCase();
  const password = this.state.password;

  axios
    .post(
      `${API_BASE}/sessions`,
      { user: { email, password } })
    .then((response) => {
  console.log("LOGIN THEN", response.status, response.data);

  const { user, token } = response.data || {};

  if (token && user) {
    localStorage.setItem("authToken", token);
    this.setState({ loginErrors: "" });
    this.props.handleSuccessfulAuth({ user, token });
    return;
  }

  this.setState({ loginErrors: "Login failed. Missing token." });
}).catch((error) => {
  console.log("LOGIN CATCH raw error:", error);

  const msg =
    error?.response?.data?.errors?.join(", ") ||
    error?.message ||
    "Login failed. Please try again.";

  this.setState({ loginErrors: msg });
});
 }



  handleChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    });
  }

  render() {
    return (
      <div>
        <form onSubmit={this.handleSubmit}>
          <div className="form-group">
            <input
              className="form-control"
              type="email"
              name="email"
              placeholder="Email"
              required
              value={this.state.email}
              onChange={this.handleChange}
            />
          </div>
          <div className="form-group">
            <input
              className="form-control"
              type="password"
              name="password"
              placeholder="Password"
              required
              value={this.state.password}
              onChange={this.handleChange}
            />
          </div>

          {this.state.loginErrors && (
            <div className="text-danger">{this.state.loginErrors}</div>
          )}
<br/>
          <button type="submit" className="btn btn-primary btn-sm">
            Login
          </button>
        </form>
      </div>
    );
  }
}
