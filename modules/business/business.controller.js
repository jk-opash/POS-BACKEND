import { getAllBusinesses, getBusinessById, updateBusiness, getAllOnboardedBusinesses, provisionBusiness, resetOwnerPassword } from "./business.service.js";
import { sendNotification } from "../socket/socket.service.js";

export async function getBusinessesHandler(req, res) {
  try {
    const businesses = await getAllBusinesses();
    res.json(businesses);
  } catch (err) {
    console.error("Error in getBusinessesHandler:", err);
    res.status(500).json({ error: "Failed to fetch businesses" });
  }
}

export async function getBusinessByIdHandler(req, res) {
  try {
    const { id } = req.params;
    const business = await getBusinessById(id);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }
    res.json(business);
  } catch (err) {
    console.error("Error in getBusinessByIdHandler:", err.message || err);
    res.status(500).json({ error: err.message || "Failed to fetch business" });
  }
}

export async function updateBusinessHandler(req, res) {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const updatedBusiness = await updateBusiness(id, data);
    res.json({ message: "Business updated successfully", data: updatedBusiness });
  } catch (err) {
    console.error("Error in updateBusinessHandler:", err);
    res.status(500).json({ error: "Failed to update business" });
  }
}

export async function getOnboardingRequestsHandler(req, res) {
  try {
    const businesses = await getAllOnboardedBusinesses();
    res.json(businesses);
  } catch (err) {
    console.error("Error in getOnboardingRequestsHandler:", err);
    res.status(500).json({ error: "Failed to fetch onboarding requests" });
  }
}

export async function provisionBusinessHandler(req, res) {
  try {
    const superadminId = req.user.id;
    const data = req.body;

    const ownerName = data.ownerName || data.owner_name;
    const ownerEmail = data.ownerEmail || data.owner_email;
    const ownerPassword = data.ownerPassword || data.password;
    const businessName = data.businessName || data.name;
    const businessSlug = data.businessSlug || data.slug;

    // Validate required fields
    if (!ownerName || !ownerEmail || !ownerPassword || !businessName || !businessSlug) {
      return res.status(400).json({ error: "Missing required onboarding fields" });
    }

    const result = await provisionBusiness(data, superadminId);
    
    // Notify all admins about platform growth
    sendNotification({
      title: "New Business Onboarded",
      message: `Growth: '${businessName}' just registered for a new account!`,
      type: "PLATFORM_GROWTH",
      referenceId: result.business?.id,
      targetBusiness: null,
      targetBranch: null, // Broadcast to admins
      targetUser: null
    }).catch(err => console.error("Notification error:", err));

    res.status(201).json({ message: "Business provisioned successfully", data: result });
  } catch (err) {
    console.error("Error in provisionBusinessHandler:", err);
    // Handle Prisma unique constraint errors (e.g. email or slug already exists)
    if (err.code === 'P2002') {
      return res.status(409).json({ error: `A record with this ${err.meta?.target?.[0] || 'unique field'} already exists.` });
    }
    res.status(500).json({ error: err.message || "Failed to provision business" });
  }
}

export async function resetOwnerPasswordHandler(req, res) {
  try {
    const { id } = req.params;
    const { newPassword: customPassword } = req.body;
    const newPassword = await resetOwnerPassword(id, customPassword);
    res.json({ message: "Password reset successfully", newPassword });
  } catch (err) {
    console.error("Error in resetOwnerPasswordHandler:", err);
    res.status(500).json({ error: err.message || "Failed to reset password" });
  }
}
