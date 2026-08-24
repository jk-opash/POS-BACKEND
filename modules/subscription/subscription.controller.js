import * as subscriptionService from "./subscription.service.js";

// @route   GET /api/subscription/invoices
// @desc    Get all subscription invoices
export const getAllInvoicesHandler = async (req, res) => {
  try {
    const invoices = await subscriptionService.getAllInvoices();
    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ message: "Server error fetching invoices" });
  }
};

// @route   GET /api/subscription
// @desc    Get all subscriptions
export const getAllSubscriptionsHandler = async (req, res) => {
  try {
    const subscriptions = await subscriptionService.getAllSubscriptions();
    res.json(subscriptions);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({ message: "Server error fetching subscriptions" });
  }
};

// @route   POST /api/subscription
// @desc    Add a new subscription plan
export const addSubscriptionHandler = async (req, res) => {
  try {
    // Basic validation
    const { plan } = req.body;
    if (!plan) {
      return res.status(400).json({ message: "Plan name is required" });
    }

    const newSubscription = await subscriptionService.addSubscription(req.body);
    res.status(201).json(newSubscription);
  } catch (error) {
    console.error("Error adding subscription:", error);
    res.status(500).json({ message: error.message || "Server error adding subscription" });
  }
};

// @route   PUT /api/subscription/:id
// @desc    Edit a subscription plan
export const editSubscriptionHandler = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Basic validation
    if (!id) {
      return res.status(400).json({ message: "Subscription ID is required" });
    }

    const updatedSubscription = await subscriptionService.editSubscription(id, req.body);
    res.json(updatedSubscription);
  } catch (error) {
    res.status(500).json({ message: "Server error editing subscription" });
  }
};

// @route   POST /api/subscription/addons
// @desc    Purchase extra branches or staff members
export const purchaseAddonsHandler = async (req, res) => {
  try {
    const { business_id, addons, amount, currency } = req.body;
    
    // Basic validation
    if (!business_id || !addons) {
      return res.status(400).json({ message: "Business ID and addons data are required" });
    }

    const updatedBusiness = await subscriptionService.purchaseAddons(req.body);
    res.status(201).json(updatedBusiness);
  } catch (error) {
    console.error("Error purchasing addons:", error);
    res.status(500).json({ message: error.message || "Server error purchasing addons" });
  }
};
