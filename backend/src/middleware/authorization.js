/**
 * Authorization Middleware
 * Handles organization membership checks and role-based access control
 */

const { createClient } = require("../config/supabase");

/**
 * Middleware to check if user is a member of the specified organization
 * Extracts organization_id from params, query, or body
 * Attaches userRole and organizationId to request
 */
const checkOrgMembership = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Try to extract organization_id from different sources
    const organizationId =
      req.params.organizationId ||
      req.params.id || // For routes like GET /organizations/:id
      req.query.organization_id ||
      req.body.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        error: "Organization ID required",
        message: "Please provide organization_id in request",
      });
    }

    // Check if user is a member of this organization
    const supabase = createClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("role, is_active")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .single();

    if (error || !data) {
      return res.status(403).json({
        error: "Access denied",
        message: "You are not a member of this organization",
      });
    }

    if (!data.is_active) {
      return res.status(403).json({
        error: "Access denied",
        message: "Your membership in this organization is inactive",
      });
    }

    // Attach organization context to request
    req.userRole = data.role;
    req.organizationId = organizationId;

    next();
  } catch (error) {
    console.error("Organization membership check error:", error);
    return res.status(500).json({
      error: "Authorization error",
      message: "Failed to verify organization membership",
    });
  }
};

/**
 * Middleware factory to require specific roles
 * @param {string[]} allowedRoles - Array of allowed roles (e.g., ['org_admin', 'accountant'])
 * @returns {Function} Express middleware
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(403).json({
        error: "No role found",
        message: "Organization membership must be verified first",
      });
    }

    // Super admins have access to everything
    if (req.userRole === "super_admin") {
      return next();
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: `This action requires one of the following roles: ${allowedRoles.join(
          ", "
        )}`,
        required: allowedRoles,
        current: req.userRole,
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has ANY organization membership
 * Used for endpoints that need user to belong to at least one organization
 */
const requireAnyOrgMembership = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1);

    if (error || !data || data.length === 0) {
      return res.status(403).json({
        error: "No organization membership",
        message: "You must be a member of at least one organization",
      });
    }

    next();
  } catch (error) {
    console.error("Organization membership check error:", error);
    return res.status(500).json({
      error: "Authorization error",
      message: "Failed to verify organization membership",
    });
  }
};

/**
 * Middleware to verify user is accessing their own resource
 * Checks if :userId param matches authenticated user
 */
const checkOwnResource = (req, res, next) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user.id;

  if (targetUserId !== currentUserId) {
    return res.status(403).json({
      error: "Access denied",
      message: "You can only access your own resources",
    });
  }

  next();
};

module.exports = {
  checkOrgMembership,
  requireRole,
  requireAnyOrgMembership,
  checkOwnResource,
};
