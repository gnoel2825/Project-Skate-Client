import React from "react";
import { useNavigate } from "react-router-dom";
import Home from "./home"; // ✅ correct relative import

export default function HomeWithNav(props) {
  const navigate = useNavigate();
  return <Home {...props} navigate={navigate} />;
}
