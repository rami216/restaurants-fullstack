import axios from "axios";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

const api = axios.create({
  baseURL: API_BASE, // uses Render env in prod, localhost in dev
  withCredentials: true,
});

export default api;
