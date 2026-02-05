import React, { useState, useEffect } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import DangerZone from "./DangerZone";
import Button from "react-bootstrap/Button";

const API_BASE = process.env.REACT_APP_API_BASE_URL;


export default function Settings({ currentUser, setCurrentUser }) {
  const navigate = useNavigate();

  // Redirect away if logged out/deleted
  useEffect(() => {
    if (!currentUser) navigate("/", { replace: true });
  }, [currentUser, navigate]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [firstName, setFirstName] = useState(currentUser?.first_name || "");
  const [lastName, setLastName] = useState(currentUser?.last_name || "");
  const [email, setEmail] = useState(currentUser?.email || "");

  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState([]);

  const profileUnchanged =
    firstName === (currentUser?.first_name || "") &&
    lastName === (currentUser?.last_name || "") &&
    email === (currentUser?.email || "");

  if (!currentUser) return null;

  // shared button style (small, rounded pill, 12px)
  const pillBtn = {
    borderRadius: 999,
    fontSize: 12,
    padding: "6px 12px",
    lineHeight: 1.1
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    setMessage("");
    setErrors([]);

    api
      .patch(
        `${API_BASE}/password`,
        {
          user: {
            current_password: currentPassword,
            password: password,
            password_confirmation: passwordConfirmation,
          },
        },
        { withCredentials: true }
      )
      .then(() => {
        setMessage("Password updated successfully.");
        setCurrentPassword("");
        setPassword("");
        setPasswordConfirmation("");
      })
      .catch((error) => {
        const apiErrors = error.response?.data?.errors;
        setErrors(apiErrors && Array.isArray(apiErrors) ? apiErrors : ["Password update failed."]);
      });
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setMessage("");
    setErrors([]);

    api
      .patch(
        `${API_BASE}/profile`,
        {
          user: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim().toLowerCase(),
          },
        },
        { withCredentials: true }
      )
      .then((res) => {
        setMessage("Profile updated successfully.");
        setCurrentUser(res.data.user ?? res.data);
      })
      .catch((error) => {
        const apiErrors = error.response?.data?.errors;
        setErrors(Array.isArray(apiErrors) ? apiErrors : ["Profile update failed."]);
      });
  };

  const avatarLetter = (currentUser?.first_name?.[0] || currentUser?.email?.[0] || "?").toUpperCase();

  return (
    <div className="container" style={{ maxWidth: 1000, marginTop: 16 }}>
      <div style={{ fontSize: "clamp(18px, 4.6vw, 22px)", letterSpacing: -0.2, marginBottom: 12 }}>
        Account Settings
      </div>

      {message && <div className="alert alert-success">{message}</div>}

      {errors.length > 0 && (
        <div className="alert alert-danger">
          <ul className="mb-0">
            {errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ===== Profile card ===== */}
      <div className="border rounded-3 bg-white mb-3" style={{ padding: 14, boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}>
        <div
          className="text-muted"
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Profile
        </div>

        <div className="d-flex flex-column flex-md-row gap-3 align-items-start">
          <div className="d-flex flex-column align-items-center justify-content-center" style={{ width: 120, flex: "0 0 auto" }}>
            <div
              className="d-flex align-items-center justify-content-center"
              style={{
                width: 84,
                height: 84,
                borderRadius: 14,
                background: "rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.06)",
                fontWeight: 900,
                fontSize: 28,
                letterSpacing: 0.8,
              }}
              aria-hidden="true"
              title="Avatar"
            >
              {avatarLetter}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="flex-grow-1" style={{ maxWidth: 560 }}>
            <div className="mb-3">
              <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                Email
              </label>
              <input
                className="form-control"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="d-grid d-md-flex" style={{ gap: 12 }}>
              <div className="flex-grow-1">
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                  First name
                </label>
                <input className="form-control" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>

              <div className="flex-grow-1">
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                  Last name
                </label>
                <input className="form-control" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="mt-3 d-flex gap-2 align-items-center">
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={profileUnchanged}
                style={pillBtn}
              >
                Save profile
              </Button>

              {!profileUnchanged && (
                <span className="text-muted" style={{ fontSize: 12 }}>
                  You have unsaved changes
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ===== Password card ===== */}
      <div className="border rounded-3 bg-white mb-3" style={{ padding: 14, boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}>
        <div
          className="text-muted"
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Security
        </div>

        <div className="fw-semibold" style={{ marginBottom: 10 }}>
          Change password
        </div>

        <form onSubmit={handleChangePassword} style={{ maxWidth: 420 }}>
          <div className="mb-2">
            <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
              Current password
            </label>
            <input
              className="form-control"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div className="mb-2">
            <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
              New password
            </label>
            <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <div className="mb-3">
            <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
              Confirm new password
            </label>
            <input
              className="form-control"
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
            />
          </div>

          <Button type="submit" size="sm" variant="primary" style={pillBtn}>
            Update password
          </Button>
        </form>
      </div>

      {/* ===== Danger zone card ===== */}
      <div className="border rounded-3 bg-white" style={{ padding: 14, boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}>
        <div
          className="text-muted"
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Danger zone
        </div>

        <DangerZone setCurrentUser={setCurrentUser} />
      </div>
    </div>
  );
}
