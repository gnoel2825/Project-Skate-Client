import React, { Component } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Navi } from "./components/Navi";
import api from "./api";
import "bootstrap/dist/css/bootstrap.min.css";
import '@coreui/coreui/dist/css/coreui.min.css'
import "./App.css";
import Registration from "./auth/registration";
import Dashboard from "./components/dashboard";
import HomeWithNav from "./components/HomeWithNav";
import Settings from "./components/settings";
import Skills from "./components/Skills";
import CreateLessonPlan from "./components/CreateLessonPlan";
import MyLessonPlans from "./components/MyLessonPlans";
import LessonPlanShow from "./components/LessonPlanShow";
import CalendarPage from "./components/CalendarPage";
import RostersIndex from "./components/RostersIndex";
import RosterForm from "./components/RosterForm";
import RosterShow from "./components/RosterShow";
import StudentsIndex from "./components/StudentsIndex";
import StudentShow from "./components/StudentShow";
import StudentNew from "./components/StudentNew";
import AdminUsersPage from "./components/AdminUsersPage";


const API_BASE = process.env.REACT_APP_API_BASE_URL;


export default class App extends Component {
 constructor(props) {
    super(props);

    this.state = {
      loggedInStatus: "NOT_LOGGED_IN",
      currentUser: null,
      authChecked: false
    };

    this.handleLogin = this.handleLogin.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
    this.handleSuccessfulAuth = this.handleSuccessfulAuth.bind(this);
    this.setCurrentUser = this.setCurrentUser.bind(this);

  }

  setCurrentUser(user) {
  this.setState({ currentUser: user });
}


  checkLoginStatus() {
  api
    .get(`${API_BASE}/logged_in`)
    .then((response) => {
      const nextStatus = response.data.logged_in ? "LOGGED_IN" : "NOT_LOGGED_IN";
      const nextUser = response.data.user || null;

      this.setState((prev) => {
        const sameStatus = prev.loggedInStatus === nextStatus;
        const sameUserId = (prev.currentUser?.id ?? null) === (nextUser?.id ?? null);
        if (sameStatus && sameUserId && prev.authChecked) return null;

        return { loggedInStatus: nextStatus, currentUser: nextUser, authChecked: true };
      });
    })
    .catch((error) => {
      console.log("login error", error);
      this.setState({ loggedInStatus: "NOT_LOGGED_IN", currentUser: null, authChecked: true });
    });
}

  handleSuccessfulAuth(data) {
    this.handleLogin(data);
    // routing handles redirect
  }

  componentDidMount() {
    this.checkLoginStatus();
  }

  handleLogin(data) {
  this.setState({
    loggedInStatus: "LOGGED_IN",
    currentUser: data.user
  });
}


  handleLogout() {
    this.setState({
      loggedInStatus: "NOT_LOGGED_IN",
      currentUser: null
    });
  }

  render() {
  const loggedIn = this.state.loggedInStatus === "LOGGED_IN";
  const currentUser = this.state.currentUser;

  return (
    <BrowserRouter>
      <div className={loggedIn ? "app-shell" : "app"}>
        {loggedIn && (
          <Navi
            handleLogout={this.handleLogout}
            currentUser={this.state.currentUser}
          />
        )}

        <main className={loggedIn ? "app-main" : ""}>
          <Routes>
            <Route
              path="/"
              element={
                !this.state.authChecked ? null :
                loggedIn
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
                loggedIn
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
                !this.state.authChecked ? null :
                loggedIn
                  ? (
                    <CalendarPage currentUser={this.state.currentUser} />
                  )
                  : <Navigate to="/" replace />
              }
            />

            <Route path="/skills" element={<Skills />} />

            <Route path="/lesson-plans" element={<MyLessonPlans />} />
            <Route path="/lesson-plans/:id" element={<LessonPlanShow />} />
            <Route path="/lesson-plans/new" element={<CreateLessonPlan />} />
            
            {/* Roster Routes */}
            <Route
              path="/rosters"
              element={
                !this.state.authChecked ? null :
                this.state.loggedInStatus === "LOGGED_IN"
                  ? <RostersIndex currentUser={this.state.currentUser}/>
                  : <Navigate to="/" replace />
              }
            />

            <Route
              path="/rosters/new"
              element={
                !this.state.authChecked ? null :
                this.state.loggedInStatus === "LOGGED_IN"
                  ? <RosterForm />
                  : <Navigate to="/" replace />
              }
            />

            <Route
              path="/rosters/:id"
              element={
                !this.state.authChecked ? null :
                this.state.loggedInStatus === "LOGGED_IN"
                  ? <RosterShow currentUser={this.state.currentUser}/>
                  : <Navigate to="/" replace />
              }
            />

            <Route
              path="/rosters/:id/edit"
              element={
                !this.state.authChecked ? null :
                this.state.loggedInStatus === "LOGGED_IN"
                  ? <RosterForm />
                  : <Navigate to="/" replace />
              }
            />


          <Route path="/students" element={<StudentsIndex currentUser={this.state.currentUser}/>} />
          <Route path="/students/:id" element={<StudentShow currentUser={this.state.currentUser}/>} />
          <Route path="/students/new" element={<StudentNew currentUser={this.state.currentUser} />} />



          <Route
            path="/calendar"
            element={<CalendarPage currentUser={this.state.currentUser} />}
          />

            <Route
              path="/settings"
              element={
                !this.state.authChecked ? null :
                loggedIn
                  ? (
                    <Settings
                      currentUser={this.state.currentUser}
                      setCurrentUser={this.setCurrentUser}
                    />
                  )
                  : <Navigate to="/" replace />
              }
            />

            <Route
              path="/admin/users"
              element={
                !this.state.authChecked ? null :
                loggedIn && this.state.currentUser?.role === "admin"
                  ? <AdminUsersPage />
                  : <Navigate to="/" replace />
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}}