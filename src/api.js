// src/api.js
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE,
  // you are using Bearer tokens now, not cookies:
  withCredentials: false,
});

// attach token to *every* request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
