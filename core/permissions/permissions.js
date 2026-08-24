/**
 * @typedef {import("../../modules/auth/auth.service.js").AuthPayload} AuthPayload
 */

// Superadmin -> creates admins and businesses
/**
 * @param {AuthPayload} actor
 * @returns {boolean}
 */
export function canCreateAdmin(actor) {
  return actor.role === "superadmin";
}

/**
 * @param {AuthPayload} actor
 * @returns {boolean}
 */
export function canCreateBusiness(actor) {
  return actor.role === "superadmin";
}

// Admin or manager -> creates/manages branches within their own business
/**
 * @param {AuthPayload} actor
 * @param {string} businessId
 * @returns {boolean}
 */
export function canManageBranch(actor, businessId) {
  return (actor.role === "admin" || actor.role === "manager") && actor.businessId === businessId;
}

// Admin only -> creates managers within their own business
/**
 * @param {AuthPayload} actor
 * @param {string} businessId
 * @returns {boolean}
 */
export function canCreateManager(actor, businessId) {
  return actor.role === "admin" && actor.businessId === businessId;
}

// Admin or manager -> creates regular staff within their own business
/**
 * @param {AuthPayload} actor
 * @param {string} businessId
 * @returns {boolean}
 */
export function canCreateStaff(actor, businessId) {
  return (actor.role === "admin" || actor.role === "manager") && actor.businessId === businessId;
}
