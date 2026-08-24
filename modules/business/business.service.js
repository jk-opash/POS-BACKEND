import { prisma } from "../../config/database.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function getAllBusinesses() {
  try {
    return await prisma.business.findMany({
      include: {
        admin: true,
        superadmin: true,
        subscription_plan: true,
      },
      orderBy: { created_at: "asc" },
    });
  } catch (err) {
    console.warn(
      "Fallback getAllBusinesses without subscription_plan:",
      err.message,
    );
    return await prisma.business.findMany({
      include: {
        admin: true,
        superadmin: true,
      },
      orderBy: { created_at: "asc" },
    });
  }
}

export async function getBusinessById(id) {
  try {
    return await prisma.business.findUnique({
      where: { id },
      include: {
        admin: true,
        superadmin: true,
        branches: true,
        subscription_plan: true,
        invoices: {
          orderBy: { created_at: "asc" },
        },
        teamMembers: {
          include: {
            branch: true,
          },
        },
      },
    });
  } catch (err) {
    console.warn(
      "Fallback getBusinessById without subscription_plan/invoices:",
      err.message,
    );
    return await prisma.business.findUnique({
      where: { id },
      include: {
        admin: true,
        superadmin: true,
        branches: true,
        teamMembers: {
          include: {
            branch: true,
          },
        },
      },
    });
  }
}

export async function updateBusiness(id, data) {
  // Extract fields that shouldn't be updated directly or handle specific logic
  const { 
    admin, superadmin, branches, invoices, 
    max_branches, max_team_members,
    admin_name, admin_email, admin_phone,
    ...updateData 
  } = data;

  const business = await prisma.business.findUnique({ where: { id } });
  
  if (business) {
    // Update SubscriptionPlan if limits are provided
    if ((max_branches !== undefined || max_team_members !== undefined) && business.subscription_plan_id) {
      await prisma.subscriptionPlan.update({
        where: { id: business.subscription_plan_id },
        data: {
          ...(max_branches !== undefined && { max_branches }),
          ...(max_team_members !== undefined && { max_team_members }),
        }
      });
    }

    // Update Admin if owner details are provided, or if is_active changes
    if ((admin_name !== undefined || admin_email !== undefined || admin_phone !== undefined || updateData.is_active !== undefined) && business.admin_id) {
      await prisma.admin.update({
        where: { id: business.admin_id },
        data: {
          ...(admin_name !== undefined && { name: admin_name }),
          ...(admin_email !== undefined && { email: admin_email }),
          ...(admin_phone !== undefined && { phone: admin_phone }),
          ...(updateData.is_active !== undefined && { is_active: updateData.is_active }),
        }
      });
    }
  }

  return await prisma.business.update({
    where: { id },
    data: updateData,
  });
}

export async function getAllOnboardedBusinesses() {
  const businesses = await prisma.business.findMany({
    include: {
      admin: true,
    },
    orderBy: { created_at: "asc" },
  });

  return businesses.map((b) => {
    let frontendStatus = "pending_review";
    if (b.status === "active") frontendStatus = "completed";
    else if (b.status === "trial") frontendStatus = "approved";
    else if (b.status === "suspended") frontendStatus = "draft";
    else if (b.status === "deleted") frontendStatus = "rejected";

    return {
      id: b.id,
      ownerName: b.admin?.name || "N/A",
      ownerEmail: b.admin?.email || "N/A",
      ownerPhone: b.admin?.phone || b.phone || "N/A",
      businessName: b.name,
      businessType: b.business_type,
      industry: b.business_type,
      currentStep: b.status === "active" ? 8 : 1,
      totalSteps: 8,
      completionPercentage: b.status === "active" ? 100 : 25,
      status: frontendStatus,
      startedAt: b.created_at,
      updatedAt: b.updated_at,
      notes:
        b.status === "active" ? "Fully provisioned" : "Awaiting completion",
    };
  });
}

export async function provisionBusiness(data, superadminId) {
  const ownerName = data.ownerName || data.owner_name;
  const ownerEmail = data.ownerEmail || data.owner_email;
  const ownerPassword = data.ownerPassword || data.password;
  const ownerPhone = data.ownerPhone || data.phone;
  const businessName = data.businessName || data.name;
  const businessSlug = data.businessSlug || data.slug;
  const businessLegalName =
    data.businessLegalName || data.legal_name || businessName;
  const businessType = data.businessType || data.business_type;
  const businessEmail = data.businessEmail || data.email;
  const businessWebsite = data.businessWebsite || data.website;
  const address = data.address || data.address_line1;
  const addressLine2 = data.addressLine2 || data.address_line2;
  const city = data.city;
  const state = data.state;
  const country = data.country;
  const pincode = data.pincode;
  const gstin = data.gstin;
  const pan = data.pan;
  const subscriptionPlanId = data.subscriptionPlanId;

  // Hash password
  const hashedPassword = await bcrypt.hash(ownerPassword, 10);

  // Validate business_type
  const allowedTypes = [
    "restaurant",
    "cafe",
    "retail",
    "grocery",
    "pharmacy",
    "salon",
    "hotel",
    "electronics",
    "clothing",
    "hardware",
    "bakery",
  ];
  const finalBusinessType = allowedTypes.includes(businessType)
    ? businessType
    : "restaurant";

  // Find targeted or default subscription plan
  let plan = null;
  if (subscriptionPlanId) {
    plan = await prisma.subscriptionPlan.findUnique({
      where: { id: subscriptionPlanId },
    });
  }
  if (!plan) {
    plan = await prisma.subscriptionPlan.findFirst({
      orderBy: { created_at: "asc" },
    });
  }

  // Use a Prisma transaction to create Admin, Business, and Initial Invoice together
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the Admin user
    const admin = await tx.admin.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        password_hash: hashedPassword,
        phone: ownerPhone,
        created_by_superadmin_id: superadminId,
        is_active: true,
      },
    });

    // 2. Create the Business
    const business = await tx.business.create({
      data: {
        name: businessName,
        slug: businessSlug,
        legal_name: businessLegalName || businessName,
        business_type: finalBusinessType,
        status: "active",
        phone: ownerPhone,
        email: businessEmail || ownerEmail,
        website: businessWebsite,
        gstin,
        pan,
        address_line1: address,
        address_line2: addressLine2,
        city,
        state,
        country: country || "India",
        pincode,
        admin_id: admin.id,
        created_by_superadmin_id: superadminId,
        subscription_plan_id: plan ? plan.id : undefined,
      },
    });

    // 3. Generate Initial Subscription Invoice if a plan exists
    let invoice = null;
    if (plan) {
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      invoice = await tx.subscriptionInvoice.create({
        data: {
          subscription_id: plan.id,
          business_id: business.id,
          invoice_number: invoiceNumber,
          amount: plan.amount || 0,
          currency: plan.currency || "INR",
          status: "paid",
          issued_at: new Date(),
          due_date: dueDate,
          paid_at: new Date(),
        },
      });
    }

    return { admin, business, invoice };
  });

  return result;
}

export async function resetOwnerPassword(businessId, providedPassword) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { admin_id: true },
  });

  if (!business || !business.admin_id) {
    throw new Error("Business or associated admin not found.");
  }

  // Use provided password or generate an 8-character random password
  const newPassword = providedPassword || crypto.randomBytes(4).toString("hex");
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.admin.update({
    where: { id: business.admin_id },
    data: { password_hash: hashedPassword },
  });

  return newPassword;
}
