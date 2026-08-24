import { prisma } from "../../config/database.js";

export const createUtilityBill = async (req, res) => {
  try {
    const { branch_id, vendor, utility_type, amount, payment_method } = req.body;
    
    if (!branch_id || !vendor || !utility_type || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const bill = await prisma.utilityBill.create({
      data: {
        branch_id,
        vendor,
        utility_type,
        amount: parseFloat(amount),
        payment_method
      }
    });

    res.status(201).json(bill);
  } catch (error) {
    console.error("Error creating utility bill:", error);
    res.status(500).json({ error: "Failed to create utility bill" });
  }
};

export const getUtilityBills = async (req, res) => {
  try {
    const { branch_id } = req.query;
    const filter = {};
    if (branch_id) filter.branch_id = branch_id;

    const bills = await prisma.utilityBill.findMany({
      where: filter,
      orderBy: { created_at: "desc" }
    });

    res.status(200).json(bills);
  } catch (error) {
    console.error("Error fetching utility bills:", error);
    res.status(500).json({ error: "Failed to fetch utility bills" });
  }
};
