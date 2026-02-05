import React from "react";
import axios from "axios";

export default function Dashboard({ handleLogout, currentUser }) {
  const handleClick = () => {
    axios
      .delete("http://localhost:3000/logout", { withCredentials: true })
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
