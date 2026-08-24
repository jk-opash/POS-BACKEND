import { getAllAdmins, updateAdmin } from "./admin.service.js";

export async function getAdminsHandler(req, res) {
  try {
    const admins = await getAllAdmins();
    res.json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ error: "Failed to fetch admins" });
  }
}

export async function updateAdminHandler(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const admin = await updateAdmin(id, updateData);
    res.json(admin);
  } catch (error) {
    console.error("Error updating admin:", error);
    res.status(500).json({ error: "Failed to update admin" });
  }
}
