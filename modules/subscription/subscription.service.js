import { prisma } from "../../config/database.js";

// Get all subscription invoices
export async function getAllInvoices() {
  try {
    return await prisma.subscriptionInvoice.findMany({
      include: {
        business: true,
        subscription: true,
      },
      orderBy: { created_at: "asc" },
    });
  } catch (err) {
    console.warn("Fallback getAllInvoices error:", err.message);
    return [];
  }
}

// Get all subscriptions
export async function getAllSubscriptions() {
  return await prisma.subscriptionPlan.findMany({
    orderBy: { created_at: "desc" },
  });
}

// Add a new subscription plan
export async function addSubscription(data) {
  const {
    plan,
    billing_cycle,
    amount,
    currency,
    max_branches,
    max_team_members,
    is_public,
  } = data;

  return await prisma.subscriptionPlan.create({
    data: {
      plan,
      billing_cycle: billing_cycle || "monthly",
      amount: amount || 0,
      currency: currency || "INR",
      max_branches: max_branches || 0,
      max_team_members: max_team_members || 0,
      is_public: is_public ?? true,
    },
  });
}

// Edit a subscription plan
export async function editSubscription(id, data) {
  const {
    plan,
    billing_cycle,
    amount,
    currency,
    max_branches,
    max_team_members,
    is_active,
    is_public,
  } = data;

  return await prisma.subscriptionPlan.update({
    where: { id },
    data: {
      plan,
      billing_cycle,
      amount,
      currency,
      max_branches,
      max_team_members,
      is_active,
      ...(is_public !== undefined && { is_public }),
      updated_at: new Date(),
    },
  });
}

// Purchase extra branches and team members for a business
export async function purchaseAddons(data) {
  const { business_id, addons, amount, currency } = data;

  return await prisma.$transaction(async (tx) => {
    // 1. Update the business to increment the extra addons
    const updatedBusiness = await tx.business.update({
      where: { id: business_id },
      data: {
        extra_branches: {
          increment: addons?.branches || 0,
        },
        extra_team_members: {
          increment: addons?.team_members || 0,
        },
      },
    });

    // 2. Create an invoice for this addon purchase
    // Generate a unique invoice number
    const invoiceNumber = `INV-ADDON-${Date.now()}`;

    // Create the invoice
    await tx.subscriptionInvoice.create({
      data: {
        business_id: business_id,
        invoice_number: invoiceNumber,
        amount: amount || 0,
        currency: currency || "INR",
        status: "paid", // Assuming immediate payment success
        payment_method: data.payment_method,
        issued_at: new Date(),
        due_date: new Date(),
        paid_at: new Date(),
        plan_snapshot: addons, // Store what was purchased
      },
    });

    return updatedBusiness;
  });
}
