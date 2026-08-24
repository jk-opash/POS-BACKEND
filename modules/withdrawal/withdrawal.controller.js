import { prisma } from "../../config/database.js";

export const createWithdrawal = async (req, res) => {
  try {
    const { branch_id, amount, withdrawn_by, payment_method, withdrawal_date, description } = req.body;
    
    if (!branch_id || !amount || !withdrawn_by) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        branch_id,
        amount: parseFloat(amount),
        withdrawn_by,
        payment_method,
        withdrawal_date: withdrawal_date ? new Date(withdrawal_date) : new Date(),
        description
      }
    });

    res.status(201).json(withdrawal);
  } catch (error) {
    console.error("Error creating withdrawal:", error);
    res.status(500).json({ error: "Failed to create withdrawal" });
  }
};

export const getWithdrawals = async (req, res) => {
  try {
    const { branch_id } = req.query;
    const filter = {};
    if (branch_id) filter.branch_id = branch_id;

    const withdrawals = await prisma.withdrawal.findMany({
      where: filter,
      include: {
        team_member: {
          select: { first_name: true, last_name: true, email: true }
        }
      },
      orderBy: { withdrawal_date: "desc" }
    });

    res.status(200).json(withdrawals);
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    res.status(500).json({ error: "Failed to fetch withdrawals" });
  }
};
