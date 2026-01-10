import { Utils } from "./ui.js";

const API_CONFIG = {
  baseURL:
    window.location.hostname.includes("github.dev") ||
    window.location.hostname.includes("app.github.dev")
      ? "https://studious-space-telegram-5gj47g7j6rvxhvv94-3000.app.github.dev/api/v1"
      : "http://localhost:3000/api/v1",
  timeout: 30000, // 30 seconds
};

export const API = {
  async request(endpoint, options = {}) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    const token = Utils.loadFromStorage("scholar_token");

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    const config = {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      console.log("📡 API Request:", url, options.method || "GET");

      const response = await fetch(url, config);
      clearTimeout(id);

      let data;
      try {
        data = await response.json();
      } catch {
        data = { error: { message: "Invalid response from server" } };
      }

      console.log("📡 API Response:", response.status, data);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("scholar_token");
          localStorage.removeItem("currentUser");
          window.location.reload();
        }
        throw new Error(
          data.error?.message ||
            `Request failed with status ${response.status}`,
        );
      }

      return data;
    } catch (error) {
      clearTimeout(id);
      console.error("❌ API Error:", error);
      throw error;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },
  post(endpoint, body) {
    console.log("📤 POST Body:", body);
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  patch(endpoint, body) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },

  async upload(endpoint, formData) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    const token = Utils.loadFromStorage("scholar_token");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Upload failed");
    return data;
  },
};
