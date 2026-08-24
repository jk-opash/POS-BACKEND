import { verifyToken } from "../../modules/auth/auth.service.js";

/**
 * Middleware to authenticate user using JWT token.
 * Extracts the token from the Authorization header and attaches the decoded payload to req.user.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyToken(token);
    // Attach decoded user payload to request object
    req.user = payload;
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
}
