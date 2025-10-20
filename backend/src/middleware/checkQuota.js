/**
 * Quota Check Middleware
 * Verifies subscription limits before allowing resource creation
 */

const { createClient } = require("../config/supabase");

/**
 * Middleware factory to check if organization has quota available
 * @param {string} type - Type of quota to check: 'clients', 'documents', 'storage'
 * @returns {Function} Express middleware
 */
const checkQuota = (type) => {
  return async (req, res, next) => {
    try {
      const organizationId = req.organizationId;

      if (!organizationId) {
        return res.status(400).json({
          error: "Organization context required",
          message:
            "This middleware requires organization membership verification first",
        });
      }

      // Call database function to get quota usage
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "get_organization_quota_usage",
        {
          p_organization_id: organizationId,
        }
      );

      if (error) {
        console.error("Quota check error:", error);
        return res.status(500).json({
          error: "Failed to check quota",
          message: error.message,
        });
      }

      const usage = data[0];

      if (!usage) {
        return res.status(500).json({
          error: "Quota data not found",
          message: "Unable to retrieve organization quota information",
        });
      }

      // Check specific quota type
      let isQuotaExceeded = false;
      let quotaInfo = {};

      switch (type) {
        case "clients":
          isQuotaExceeded = usage.current_clients >= usage.max_clients;
          quotaInfo = {
            type: "clients",
            current: usage.current_clients,
            max: usage.max_clients,
            remaining: usage.max_clients - usage.current_clients,
          };
          break;

        case "documents":
          isQuotaExceeded =
            usage.current_documents_this_month >= usage.max_documents_per_month;
          quotaInfo = {
            type: "documents",
            current: usage.current_documents_this_month,
            max: usage.max_documents_per_month,
            remaining:
              usage.max_documents_per_month -
              usage.current_documents_this_month,
            period: "monthly",
          };
          break;

        case "storage":
          isQuotaExceeded = usage.current_storage_mb >= usage.max_storage_mb;
          quotaInfo = {
            type: "storage",
            current: usage.current_storage_mb,
            max: usage.max_storage_mb,
            remaining: usage.max_storage_mb - usage.current_storage_mb,
            unit: "MB",
          };
          break;

        default:
          return res.status(400).json({
            error: "Invalid quota type",
            message: `Unknown quota type: ${type}. Valid types: clients, documents, storage`,
          });
      }

      if (isQuotaExceeded) {
        return res.status(403).json({
          error: "Quota exceeded",
          message: `Your organization has reached the ${type} limit for your subscription tier`,
          quota: quotaInfo,
          subscription: {
            tier: usage.subscription_tier,
            status: usage.subscription_status,
          },
          action: "Please upgrade your subscription to continue",
        });
      }

      // Attach quota info to request for potential use in handlers
      req.quotaUsage = usage;
      req.quotaInfo = quotaInfo;

      next();
    } catch (error) {
      console.error("Quota check middleware error:", error);
      return res.status(500).json({
        error: "Quota verification failed",
        message: "Internal server error during quota check",
      });
    }
  };
};

/**
 * Middleware to check if document upload would exceed storage quota
 * Requires file size to be available in req.file.size
 */
const checkStorageQuotaForUpload = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const fileSize = req.file?.size || req.body.fileSize || 0;

    if (!fileSize) {
      return res.status(400).json({
        error: "File size required",
        message: "Unable to determine file size for quota check",
      });
    }

    const fileSizeMB = fileSize / (1024 * 1024);

    // Get current usage
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_organization_quota_usage", {
      p_organization_id: organizationId,
    });

    if (error || !data || data.length === 0) {
      console.error("Storage quota check error:", error);
      return res.status(500).json({
        error: "Failed to check storage quota",
        message: error?.message,
      });
    }

    const usage = data[0];
    const projectedUsage = usage.current_storage_mb + fileSizeMB;

    if (projectedUsage > usage.max_storage_mb) {
      return res.status(403).json({
        error: "Storage quota exceeded",
        message: "Uploading this file would exceed your storage limit",
        quota: {
          current: usage.current_storage_mb,
          max: usage.max_storage_mb,
          fileSize: fileSizeMB,
          projectedTotal: projectedUsage,
          unit: "MB",
        },
        action: "Please upgrade your subscription or delete old files",
      });
    }

    req.quotaUsage = usage;
    next();
  } catch (error) {
    console.error("Storage quota check middleware error:", error);
    return res.status(500).json({
      error: "Storage quota verification failed",
      message: "Internal server error during storage check",
    });
  }
};

/**
 * Middleware to warn about approaching quota limits (80% threshold)
 * Attaches warning to response headers without blocking request
 */
const quotaWarning = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;

    if (!organizationId) {
      return next();
    }

    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_organization_quota_usage", {
      p_organization_id: organizationId,
    });

    if (!error && data && data.length > 0) {
      const usage = data[0];
      const warnings = [];

      // Check each quota type
      if (usage.current_clients / usage.max_clients >= 0.8) {
        warnings.push(`Clients: ${usage.current_clients}/${usage.max_clients}`);
      }
      if (
        usage.current_documents_this_month / usage.max_documents_per_month >=
        0.8
      ) {
        warnings.push(
          `Documents: ${usage.current_documents_this_month}/${usage.max_documents_per_month}`
        );
      }
      if (usage.current_storage_mb / usage.max_storage_mb >= 0.8) {
        warnings.push(
          `Storage: ${Math.round(usage.current_storage_mb)}/${
            usage.max_storage_mb
          } MB`
        );
      }

      if (warnings.length > 0) {
        res.setHeader("X-Quota-Warning", warnings.join("; "));
      }
    }

    next();
  } catch (error) {
    // Don't block request on warning check failure
    console.error("Quota warning middleware error:", error);
    next();
  }
};

module.exports = {
  checkQuota,
  checkStorageQuotaForUpload,
  quotaWarning,
};
