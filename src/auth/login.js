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
      { user: { email, password } },
      { withCredentials: true }
    )
    .then((response) => {
      // ✅ If we got here, request succeeded (2xx)

      console.log("LOGIN THEN", response.status, response.data);

      if (response.data.logged_in) {
        // ✅ CLEAR any old error message
        this.setState({ loginErrors: "" });

        // ✅ update parent state
        this.props.handleSuccessfulAuth(response.data);

        return; // ✅ prevent any accidental fallthrough
      }

      // If Rails ever returns 200 but logged_in false (rare), handle it:
      this.setState({ loginErrors: "Invalid email or password" });
    })
    .catch((error) => {
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
