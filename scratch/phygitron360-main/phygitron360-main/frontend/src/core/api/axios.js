import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // 🔥 THIS IS THE FIX
});

export default api;