import axios from "axios";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ""; // e.g. https://api.zygoflow.com

// Public/custom-domain client: NO COOKIES
const saasApi = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

export default saasApi;
