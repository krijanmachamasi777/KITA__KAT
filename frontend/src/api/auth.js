// src/api/auth.js
import { apiFetch } from "./client";

/**
 * Authenticate against MeroShare via our backend.
 * Backend always runs a full sync before returning the JWT.
 */
export function loginApi(creds) {
  return apiFetch("/auth/login", null, {
    method: "POST",
    body: JSON.stringify(creds),
  });
}

/**
 * Fetch the authenticated user's own record.
 */
export function getMeApi(token) {
  return apiFetch("/auth/me", token);
}

/**
 * Clear the stored MeroShare token on the backend.
 * Called on explicit user logout.
 */
export function logoutApi(token) {
  return apiFetch("/auth/logout", token, { method: "POST" });
}
