import React, { Component } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import Navi from "./components/Navi";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import Registration from "./auth/registration";
import Dashboard from "./components/dashboard";
import HomeWithNav from "./components/HomeWithNav";

export default class App extends Component {
  constructor() {
    super();

    this.state = {
      loggedInStatus: "NOT_LOGGED_IN",
      authChecked: false
    };

    this.handleLogin = this.handleLogin.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
    this.handleSuccessfulAuth = this.handleSuccessfulAuth.bind(this);
  }


  checkLoginStatus() {
  axios
    .get("http://localhost:3000/logged_in", { withCredentials: true })
    .then((response) => {
      const nextStatus = response.data.logged_in ? "LOGGED_IN" : "NOT_LOGGED_IN";

      this.setState((prev) => {
        if (prev.loggedInStatus === nextStatus && prev.authChecked) return null;
        return { loggedInStatus: nextStatus, authChecked: true };
      });
    })
    .catch((error) => {
      console.log("login error", error);
      this.setState({ authChecked: true });
    });
}

  handleSuccessfulAuth(data) {
  this.handleLogin(data);
  // ✅ no navigate here; routing handles redirect
}

  componentDidMount() {
    this.checkLoginStatus();
  }

  handleLogin(data) {
    this.setState({ loggedInStatus: "LOGGED_IN" });
  }

  handleLogout() {
    this.setState({ loggedInStatus: "NOT_LOGGED_IN" });
  }

  render() {
    return (
      <div className="app">
        <BrowserRouter>
         {this.state.loggedInStatus === "LOGGED_IN" && (
          <Navi handleLogout={this.handleLogout} />
        )}

          <Routes>
            <Route
                path="/"
                element={
                  !this.state.authChecked ? null :
                  this.state.loggedInStatus === "LOGGED_IN"
                    ? <Navigate to="/dashboard" replace />
                    : (
                      <HomeWithNav
                        loggedInStatus={this.state.loggedInStatus}
                        handleLogin={this.handleLogin}
                        handleLogout={this.handleLogout}
                      />
                    )
                }
              />
           <Route
  path="/registration"
  element={
    this.state.loggedInStatus === "LOGGED_IN"
      ? <Navigate to="/dashboard" replace />
      : (
        <Registration
          handleSuccessfulAuth={this.handleSuccessfulAuth}
          loggedInStatus={this.state.loggedInStatus}
        />
      )
  }
/>
           <Route
  path="/dashboard"
  element={
    this.state.loggedInStatus === "LOGGED_IN"
      ? (
        <Dashboard
          handleLogout={this.handleLogout}
                    />
                  )
                  : <Navigate to="/" replace />
              }
            />

          </Routes>
        </BrowserRouter>
      </div>
    );
  }
}
