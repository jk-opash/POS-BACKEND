import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { AsyncLocalStorage } from "async_hooks";
import { pool } from "./db.js";

const adapter = new PrismaPg(pool);

// Context to store the current request's user
export const auditContext = new AsyncLocalStorage();

const basePrisma = new PrismaClient({
  adapter,
  log: ["query", "info", "warn", "error"],
});

// Models we want to automatically track changes for
const AUDITED_MODELS = [
  "Order", "Invoice", "Expense", "MenuItem", 
  "TeamMember", "Branch", "Business", "SubscriptionPlan"
];

// Extend Prisma to automatically intercept mutations on audited models
const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Run the actual query first
        const result = await query(args);

        // Only care about mutations on specific models
        const isMutation = ["create", "update", "delete", "createMany", "updateMany", "deleteMany"].includes(operation);
        if (isMutation && AUDITED_MODELS.includes(model)) {
          // Get the actor (user) from the current request context
          const actor = auditContext.getStore();
          console.log(`[AuditLog] Intercepted ${operation} on ${model}. Actor found:`, !!actor);
          
          const resolvedBusinessId = actor ? (actor.businessId || (result && (result.business_id || (model === 'Business' ? result.id : null)))) : null;
          if (actor && resolvedBusinessId) {
            // Determine severity & action text
            let severity = "info";
            if (operation === "delete" || operation === "deleteMany") {
              severity = "critical";
            } else if ((operation === "update" || operation === "updateMany") && args.data) {
              // Elevate severity for high-risk modifications
              const s = args.data.status ? String(args.data.status).toLowerCase() : null;
              if (s === "suspended" || s === "inactive" || args.data.is_active === false) {
                severity = "warning";
              }
              if (args.data.password_hash || args.data.pin) {
                severity = "critical";
              }
              if (args.data.subscription_plan_id) {
                severity = "warning";
              }
            }

            // Extract a human-readable identifier for the record
            let recordIdentifier = "record";
            if (result) {
              if (result.count !== undefined) {
                recordIdentifier = `${result.count} records`;
              } else {
                const nameField = result.name || result.title || result.invoice_number || result.order_number || result.first_name || result.company_name;
                recordIdentifier = nameField ? String(nameField) : String(result.id || "record");
              }
            } else if (args.where && args.where.id) {
              recordIdentifier = String(args.where.id);
            }
            
            if (recordIdentifier.length > 40) {
              recordIdentifier = recordIdentifier.substring(0, 40) + '...';
            }

            // Determine genuine action name with identifier
            let actionName = `${model} ${operation}`;
            if (operation === "create" || operation === "createMany") {
              actionName = `Created new ${model} '${recordIdentifier}'`;
            } else if (operation === "update" || operation === "updateMany") {
              let actionPrefix = `Updated ${model}`;
              if (args.data) {
                // Logical action mapping based on updated fields
                if (args.data.status) {
                   const s = String(args.data.status).toLowerCase();
                   if (s === "active" || s === "verified") actionPrefix = `Activated ${model}`;
                   else if (s === "suspended" || s === "inactive") actionPrefix = `Suspended ${model}`;
                   else actionPrefix = `Changed status of ${model} to ${args.data.status}`;
                } else if (args.data.is_active !== undefined) {
                   actionPrefix = args.data.is_active ? `Activated ${model}` : `Deactivated ${model}`;
                } else if (args.data.password_hash || args.data.pin) {
                   actionPrefix = `Reset credentials for ${model}`;
                } else if (args.data.subscription_plan_id) {
                   actionPrefix = `Updated subscription for ${model}`;
                }
              }
              actionName = `${actionPrefix} '${recordIdentifier}'`;
            } else if (operation === "delete" || operation === "deleteMany") {
              actionName = `Deleted ${model} '${recordIdentifier}'`;
            }

            // Build detailed payload with the actual changes
            const detailsObj = {
              operation,
              model,
              recordId: result ? result.id : null,
              changes: args.data ? { ...args.data } : null
            };

            // Sanitize sensitive fields in the details
            if (detailsObj.changes && detailsObj.changes.password_hash) {
              detailsObj.changes.password_hash = "***";
            }
            if (detailsObj.changes && detailsObj.changes.pin) {
              detailsObj.changes.pin = "***";
            }

            const detailsStr = JSON.stringify(detailsObj);
            
            try {
              // We use basePrisma so this write doesn't trigger the extension recursively (though we filtered out AuditLog anyway)
              const safeRole = typeof actor.role === 'object' && actor.role !== null 
                ? (actor.role.name || JSON.stringify(actor.role))
                : (actor.role || "Unknown");

              await basePrisma.auditLog.create({
                data: {
                  business_id: resolvedBusinessId,
                  branch_id: actor.branchId || null,
                  actor_id: actor.id,
                  actor_name: actor.name || "Unknown User",
                  actor_role: safeRole.substring(0, 50), // Ensure it fits VarChar(50)
                  type: model, // Using model name as Type
                  action: actionName.substring(0, 150),
                  details: detailsStr,
                  severity,
                  // terminal/ip_address could be added to context if needed
                }
              });
            } catch (err) {
              console.error("[Audit Log Error] Failed to write audit log:", err);
            }
          }
        }

        return result;
      }
    }
  }
});

const connectDB = async () => {
  try {
    await basePrisma.$connect();
    console.log("✅ Database connection established successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};

export { connectDB, prisma };
