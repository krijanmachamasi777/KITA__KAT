// src/api/client.js
// ─────────────────────────────────────────────────────────────
// Central HTTP utility.
//
// Session expiry handling:
//   If ANY response returns HTTP 401 with { sessionExpired: true },
//   we dispatch a custom DOM event "meroshare:sessionExpired".
//   AuthContext listens for this event and calls logout() + redirects to login.
//   This ensures every API call in the app gets automatic session expiry handling.
// ─────────────────────────────────────────────────────────────

const BASE = "/api";

/**
 * @param {string}  path   – e.g. "/auth/login", "/portfolio"
 * @param {string|null} token – JWT from sessionStorage
 * @param {RequestInit} opts  – extra fetch options (method, body, …)
 * @returns {Promise<any>}   – the unwrapped `data` field
 */
export async function apiFetch(path, token = null, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };

  const res  = await fetch(`${BASE}${path}`, { ...opts, headers });
  const json = await res.json();

  // ── Session expiry — clear session and redirect to login ─────────
  if (res.status === 401 && json.sessionExpired) {
    const error = new Error(json.message || "MeroShare session expired. Please login again.");
    error.sessionExpired = true;
    // Notify AuthContext via a DOM event so any component can trigger logout
    window.dispatchEvent(new CustomEvent("meroshare:sessionExpired"));
    throw error;
  }

  if (!res.ok || json.success === false) {
    throw new Error(json.message || `API error ${res.status}`);
  }

  // Backend always wraps payload in { success: true, data: ... }
  return json.data !== undefined ? json.data : json;
}
