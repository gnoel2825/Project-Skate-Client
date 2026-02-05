import React, { Component } from "react";
import api from "../api";

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

 handleSubmit(e) {
  e.preventDefault();
  const email = this.state.email.trim().toLowerCase();
  const password = this.state.password;

  api.post("/sessions", { user: { email, password } })
    .then((res) => {
      localStorage.setItem("authToken", res.data.token);
      this.setState({ loginErrors: "" });

      // pass user + token up
      this.props.handleSuccessfulAuth({
        user: res.data.user,
        token: res.data.token
      });
    })
    .catch((err) => {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.errors?.join(", ") ||
        "Invalid email or password";
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
