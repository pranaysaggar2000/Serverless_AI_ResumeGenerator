/**
 * Security utilities for the Chrome Extension.
 * Centralizes HTML escaping to prevent XSS vulnerabilities.
 */

/**
 * Escapes HTML special characters in a string to prevent XSS.
 * @param {string} unsafe - The string to escape.
 * @returns {string} The escaped string. Returns empty string if input is null/undefined.
 */
export function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return "";
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/`/g, "&#96;"); // Backticks can sometimes be dangerous in certain contexts
}

/**
 * Safe version of value injection for input attributes.
 * Effectively aliases escapeHtml but semantically clearer for attribute context.
 * @param {string} val 
 * @returns {string}
 */
export function safeAttr(val) {
    return escapeHtml(val);
}
