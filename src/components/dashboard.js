import React from "react";
import api from "../api";

const API_BASE = process.env.REACT_APP_API_BASE_URL;

export default function Dashboard({ handleLogout, currentUser }) {
  const handleClick = () => {
    api
      .delete(`/logout`, { withCredentials: true })
      .then(() => {
        handleLogout(); // updates App state
      })
      .catch((error) => {
        console.error("Logout failed", error);
      });
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <h1>Welcome, {currentUser?.first_name}!</h1>
      <p>You’re logged in.</p>

      <button onClick={handleClick} className="btn btn-outline-danger">
        Log out
      </button>
    </div>
  );
}
