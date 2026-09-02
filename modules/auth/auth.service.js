import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../../config/db.js";

const JWT_EXPIRES_IN = "8h";

/**
 * @typedef {"superadmin" | "admin" | "manager" | "cashier" | "waiter" | "kitchen" | "inventory_manager"} ActorRole
 */

/**
 * @typedef {Object} AuthPayload
 * @property {string} id
 * @property {ActorRole} role
 * @property {string} [businessId]
 * @property {string|null} [branchId]
 */

/**
 * @param {string} plain
 * @returns {Promise<string>}
 */
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

/**
 * @param {AuthPayload} payload
 * @returns {string}
 */
export function issueToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not defined in environment variables");
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * @param {string} token
 * @returns {AuthPayload}
 */
export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not defined in environment variables");
  return /** @type {AuthPayload} */ (/** @type {unknown} */ (jwt.verify(token, secret)));
}

// ── Superadmin login (platform owner) ──────────────────────────────
/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string|null>}
 */
export async function loginSuperadmin(email, password) {
  const { rows } = await pool.query(
    "SELECT id, name, email, password_hash, general_data, invoice_data FROM superadmins WHERE email = $1",
    [email]
  );
  const user = rows[0];
  if (!user) return null;

  if (!(await bcrypt.compare(password, user.password_hash))) return null;

  const token = issueToken({ id: user.id, role: "superadmin", name: user.name });
  
  // Return user without password hash
  const { password_hash, ...userWithoutPassword } = user;
  return { token, user: { ...userWithoutPassword, role: "superadmin" } };
}

/**
 * @param {string} id
 * @param {Object} data
 * @param {Object} [data.general_data]
 * @param {Object} [data.invoice_data]
 * @returns {Promise<Object>}
 */
export async function updateSuperadminSettings(id, data) {
  const { general_data, invoice_data } = data;
  let updateQueries = [];
  let values = [];
  let counter = 1;

  if (general_data !== undefined) {
    updateQueries.push(`general_data = $${counter}`);
    values.push(general_data);
    counter++;
  }

  if (invoice_data !== undefined) {
    updateQueries.push(`invoice_data = $${counter}`);
    values.push(invoice_data);
    counter++;
  }

  if (updateQueries.length === 0) return null;

  values.push(id);
  const query = `
    UPDATE superadmins
    SET ${updateQueries.join(", ")}
    WHERE id = $${counter}
    RETURNING id, name, email, general_data, invoice_data
  `;

  const { rows } = await pool.query(query, values);
  return rows[0];
}

// ── Admin login (restaurant owner) ──────────────────────────────────
/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string|null>}
 */
export async function loginAdmin(email, password) {
  const { rows } = await pool.query(
    `SELECT 
       a.*,
       (
         SELECT COALESCE(json_agg(
           to_jsonb(b.*) || jsonb_build_object(
             'teamMembers', (SELECT COALESCE(json_agg(tm.*), '[]'::json) FROM team_members tm WHERE tm.business_id = b.id),
             'branches', (SELECT COALESCE(json_agg(br.*), '[]'::json) FROM branches br WHERE br.business_id = b.id),
             'subscription_plan', (SELECT to_jsonb(sp.*) FROM subscriptions sp WHERE sp.id = b.subscription_plan_id)
           )
         ), '[]'::json)
         FROM businesses b
         WHERE b.admin_id = a.id
       ) as businesses
     FROM admins a
     WHERE a.email = $1`,
    [email]
  );
  const user = rows[0];
  if (!user || !user.is_active) return null;
  if (!(await bcrypt.compare(password, user.password_hash))) return null;

  // Check if the business subscription has expired
  if (user.businesses && user.businesses.length > 0) {
    const business = user.businesses[0];
    const plan = business.subscription_plan;
    if (plan) {
      const now = new Date();
      if (plan.status === "trialing" && plan.trial_end_date && now > new Date(plan.trial_end_date)) {
        return { error: "subscription_expired", message: "Your free trial has ended. Please contact your administrator." };
      }
      if (plan.status !== "trialing" && plan.current_period_end && now > new Date(plan.current_period_end)) {
        return { error: "subscription_expired", message: "Your subscription has expired. Please contact your administrator." };
      }
    }
  }
  
  const businessId = user.businesses && user.businesses.length > 0 ? user.businesses[0].id : null;
  const token = issueToken({ id: user.id, role: "admin", businessId, name: user.name || user.first_name });
  
  const { password_hash, ...userWithoutPassword } = user;
  return { token, user: { ...userWithoutPassword, role: "admin" } };
}

// ── Manager / staff login — email + password (web dashboard) ────────
/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string|null>}
 */
export async function loginTeamMember(email, password) {
  const { rows } = await pool.query(
    `SELECT tm.*, b.name as branch_name
     FROM team_members tm
     LEFT JOIN branches b ON tm.branch_id = b.id
     WHERE tm.email = $1`,
    [email]
  );
  const user = rows[0];
  if (!user || user.status !== "Active" || !user.password_hash) return null;
  if (!(await bcrypt.compare(password, user.password_hash))) return null;

  // Check if the business subscription has expired
  if (user.business_id) {
    const { pool: pgPool } = await import("../../config/db.js");
    const { rows: planRows } = await pgPool.query(
      `SELECT sp.status, sp.trial_end_date, sp.current_period_end
       FROM businesses b
       JOIN subscriptions sp ON sp.id = b.subscription_plan_id
       WHERE b.id = $1`,
      [user.business_id]
    );
    const plan = planRows[0];
    if (plan) {
      const now = new Date();
      if (plan.status === "trialing" && plan.trial_end_date && now > new Date(plan.trial_end_date)) {
        return { error: "subscription_expired", message: "Your free trial has ended. Please contact your administrator." };
      }
      if (plan.status !== "trialing" && plan.current_period_end && now > new Date(plan.current_period_end)) {
        return { error: "subscription_expired", message: "Your subscription has expired. Please contact your administrator." };
      }
    }
  }
  
  const token = issueToken({
    id: user.id,
    name: `${user.first_name} ${user.last_name || ''}`.trim(),
    role: user.role,
    businessId: user.business_id,
    branchId: user.branch_id,
  });

  const { password_hash, ...userWithoutPassword } = user;
  return { token, user: userWithoutPassword };
}

// ── Quick PIN login — POS terminal, scoped to one branch ─────────────
// PINs are stored in plain text on purpose: this unlocks a shared
// till that's already behind physical/device access, not a standalone
// credential. Swap to a hashed compare here if you want extra defense.
/**
 * @param {string} branchId
 * @param {string} pin
 * @returns {Promise<string|null>}
 */
export async function loginTeamMemberByPin(branchId, pin) {
  const { rows } = await pool.query(
    `SELECT tm.*, b.name as branch_name
     FROM team_members tm
     LEFT JOIN branches b ON tm.branch_id = b.id
     WHERE tm.branch_id = $1 AND tm.pin = $2`,
    [branchId, pin]
  );
  const user = rows[0];
  if (!user || user.status !== "Active") return null;

  // Check if the business subscription has expired
  if (user.business_id) {
    const { pool: pgPool } = await import("../../config/db.js");
    const { rows: planRows } = await pgPool.query(
      `SELECT sp.status, sp.trial_end_date, sp.current_period_end
       FROM businesses b
       JOIN subscriptions sp ON sp.id = b.subscription_plan_id
       WHERE b.id = $1`,
      [user.business_id]
    );
    const plan = planRows[0];
    if (plan) {
      const now = new Date();
      if (plan.status === "trialing" && plan.trial_end_date && now > new Date(plan.trial_end_date)) {
        return { error: "subscription_expired", message: "Your free trial has ended. Please contact your administrator." };
      }
      if (plan.status !== "trialing" && plan.current_period_end && now > new Date(plan.current_period_end)) {
        return { error: "subscription_expired", message: "Your subscription has expired. Please contact your administrator." };
      }
    }
  }
  
  const token = issueToken({
    id: user.id,
    name: `${user.first_name} ${user.last_name || ''}`.trim(),
    role: user.role,
    businessId: user.business_id,
    branchId: user.branch_id,
  });

  const { password_hash, ...userWithoutPassword } = user;
  return { token, user: userWithoutPassword };
}
