import { loginSuperadmin, loginAdmin, loginTeamMember, loginTeamMemberByPin, updateSuperadminSettings } from "./auth.service.js";

export async function superadminLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const result = await loginSuperadmin(email, password);
    if (!result || !result.token) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ token: result.token, user: result.user });
  } catch (err) {
    console.error("Error in superadminLogin:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}

export async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const result = await loginAdmin(email, password);
    if (!result || !result.token) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ token: result.token, user: result.user });
  } catch (err) {
    console.error("Error in adminLogin:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function teamMemberLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const result = await loginTeamMember(email, password);
    if (!result || !result.token) {
      return res.status(401).json({ error: "Invalid credentials or inactive account" });
    }
    res.json({ token: result.token, user: result.user });
  } catch (err) {
    console.error("Error in teamMemberLogin:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function pinLogin(req, res) {
  try {
    const { branchId, pin } = req.body;
    if (!branchId || !pin) {
      return res.status(400).json({ error: "branchId and pin are required" });
    }
    const result = await loginTeamMemberByPin(branchId, pin);
    if (!result || !result.token) {
      return res.status(401).json({ error: "Invalid PIN or inactive account" });
    }
    res.json({ token: result.token, user: result.user });
  } catch (err) {
    console.error("Error in pinLogin:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function superadminSettingsUpdate(req, res) {
  try {
    const userId = req.user.id;
    const { general_data, invoice_data } = req.body;
    const updatedUser = await updateSuperadminSettings(userId, { general_data, invoice_data });
    if (!updatedUser) {
      return res.status(400).json({ error: "No valid data provided to update" });
    }
    res.json({ message: "Settings updated successfully", user: updatedUser });
  } catch (err) {
    console.error("Error in superadminSettingsUpdate:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
