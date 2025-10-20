/**
 * Authentication Middleware
 * Verifies JWT tokens from Supabase Auth and attaches user to request
 */

const { createClient } = require("../config/supabase");

/**
 * Middleware to require authentication
 * Validates JWT token and attaches user object to req.user
 */
const requireAuth = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "No token provided",
        message: "Authorization header with Bearer token is required",
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify token with Supabase
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: "Invalid token",
        message: error?.message || "Token verification failed",
      });
    }

    // Attach user and token to request
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      error: "Authentication error",
      message: "Internal server error during authentication",
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 * Used for endpoints that have different behavior for authenticated users
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // No token provided, continue without user
      req.user = null;
      return next();
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (!error && user) {
      req.user = user;
      req.token = token;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    req.user = null;
    next();
  }
};

module.exports = {
  requireAuth,
  optionalAuth,
};
