import * as zoneService from "./zone.service.js";

// GET /api/zone
export async function getZonesHandler(req, res) {
  try {
    const { branch_id } = req.query;
    if (!branch_id) {
      return res.status(400).json({ error: "branch_id is required" });
    }
    const zones = await zoneService.getZonesByBranch(branch_id);
    res.json({ data: zones });
  } catch (error) {
    console.error("Error fetching zones:", error);
    res.status(500).json({ error: "Failed to fetch zones" });
  }
}

// POST /api/zone
export async function createZoneHandler(req, res) {
  try {
    const zone = await zoneService.createZone(req.body);
    res.status(201).json({ data: zone });
  } catch (error) {
    console.error("Error creating zone:", error);
    res.status(500).json({ error: "Failed to create zone" });
  }
}

// PUT /api/zone/:id
export async function updateZoneHandler(req, res) {
  try {
    const { id } = req.params;
    const zone = await zoneService.updateZone(id, req.body);
    res.json({ data: zone });
  } catch (error) {
    console.error("Error updating zone:", error);
    res.status(500).json({ error: "Failed to update zone" });
  }
}

// DELETE /api/zone/:id
export async function deleteZoneHandler(req, res) {
  try {
    const { id } = req.params;
    await zoneService.deleteZone(id);
    res.json({ message: "Zone deleted successfully" });
  } catch (error) {
    console.error("Error deleting zone:", error);
    res.status(500).json({ error: "Failed to delete zone" });
  }
}
