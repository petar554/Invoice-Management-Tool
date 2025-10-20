/**
 * Client Routes
 * Handles CRUD operations for clients (customers of accounting firms)
 */

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const {
  checkOrgMembership,
  requireRole,
} = require("../middleware/authorization");
const { checkQuota } = require("../middleware/checkQuota");
const { asyncHandler, ValidationError } = require("../middleware/errorHandler");
const ClientService = require("../services/ClientService");

/**
 * GET /api/clients
 * Get all clients for an organization (with filters)
 */
router.get(
  "/",
  requireAuth,
  checkOrgMembership,
  asyncHandler(async (req, res) => {
    const organizationId = req.organizationId;

    // Parse filters from query params
    const filters = {
      is_active: req.query.is_active === "false" ? false : true,
      assigned_accountant_id: req.query.assigned_accountant_id,
      city: req.query.city,
      industry: req.query.industry,
      search: req.query.search,
      orderBy: req.query.orderBy,
      orderDirection: req.query.orderDirection,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    };

    const result = await ClientService.getByOrganization(
      organizationId,
      filters
    );

    res.json({
      success: true,
      ...result,
    });
  })
);

/**
 * POST /api/clients
 * Create a new client (with quota check)
 */
router.post(
  "/",
  requireAuth,
  checkOrgMembership,
  requireRole(["org_admin", "accountant"]),
  checkQuota("clients"), // Check if organization can add more clients
  asyncHandler(async (req, res) => {
    const client = await ClientService.create(
      req.body,
      req.organizationId,
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: "Client created successfully",
      client: client,
      quota: req.quotaInfo, // Include quota info in response
    });
  })
);

/**
 * GET /api/clients/:id
 * Get client details
 */
router.get(
  "/:id",
  requireAuth,
  checkOrgMembership,
  asyncHandler(async (req, res) => {
    const client = await ClientService.getById(
      req.params.id,
      req.organizationId
    );

    res.json({
      success: true,
      client: client,
    });
  })
);

/**
 * GET /api/clients/:id/stats
 * Get client with statistics
 */
router.get(
  "/:id/stats",
  requireAuth,
  checkOrgMembership,
  asyncHandler(async (req, res) => {
    const client = await ClientService.getWithStats(
      req.params.id,
      req.organizationId
    );

    res.json({
      success: true,
      client: client,
    });
  })
);

/**
 * PUT /api/clients/:id
 * Update client
 */
router.put(
  "/:id",
  requireAuth,
  checkOrgMembership,
  requireRole(["org_admin", "accountant"]),
  asyncHandler(async (req, res) => {
    const updated = await ClientService.update(
      req.params.id,
      req.organizationId,
      req.body
    );

    res.json({
      success: true,
      message: "Client updated successfully",
      client: updated,
    });
  })
);

/**
 * DELETE /api/clients/:id
 * Delete client (soft delete)
 */
router.delete(
  "/:id",
  requireAuth,
  checkOrgMembership,
  requireRole(["org_admin", "accountant"]),
  asyncHandler(async (req, res) => {
    const result = await ClientService.delete(
      req.params.id,
      req.organizationId
    );

    res.json({
      success: true,
      message: result.message,
    });
  })
);

/**
 * POST /api/clients/search
 * Search clients by PIB or name
 */
router.post(
  "/search",
  requireAuth,
  checkOrgMembership,
  asyncHandler(async (req, res) => {
    const { search_term } = req.body;

    if (!search_term || search_term.trim().length === 0) {
      throw new ValidationError("Search term is required");
    }

    const results = await ClientService.search(req.organizationId, search_term);

    res.json({
      success: true,
      count: results.length,
      results: results,
    });
  })
);

/**
 * GET /api/clients/:id/documents
 * Get all documents for a client
 */
router.get(
  "/:id/documents",
  requireAuth,
  checkOrgMembership,
  asyncHandler(async (req, res) => {
    const filters = {
      document_type: req.query.document_type,
      document_status: req.query.document_status,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      limit: parseInt(req.query.limit) || 50,
    };

    const documents = await ClientService.getDocuments(
      req.params.id,
      req.organizationId,
      filters
    );

    res.json({
      success: true,
      count: documents.length,
      documents: documents,
    });
  })
);

/**
 * POST /api/clients/:id/assign-accountant
 * Assign accountant to client
 */
router.post(
  "/:id/assign-accountant",
  requireAuth,
  checkOrgMembership,
  requireRole(["org_admin", "accountant"]),
  asyncHandler(async (req, res) => {
    const { accountant_id } = req.body;

    if (!accountant_id) {
      throw new ValidationError("Accountant ID is required");
    }

    const updated = await ClientService.assignAccountant(
      req.params.id,
      req.organizationId,
      accountant_id
    );

    res.json({
      success: true,
      message: "Accountant assigned successfully",
      client: updated,
    });
  })
);

/**
 * GET /api/clients/by-tax-id/:taxId
 * Find client by Tax ID (PIB) - Used by OCR routing
 */
router.get(
  "/by-tax-id/:taxId",
  requireAuth,
  checkOrgMembership,
  asyncHandler(async (req, res) => {
    const client = await ClientService.findByTaxId(
      req.params.taxId,
      req.organizationId
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found with this Tax ID",
      });
    }

    res.json({
      success: true,
      client: client,
    });
  })
);

/**
 * POST /api/clients/find-by-name
 * Find clients by name (fuzzy matching)
 */
router.post(
  "/find-by-name",
  requireAuth,
  checkOrgMembership,
  asyncHandler(async (req, res) => {
    const { name, threshold } = req.body;

    if (!name || name.trim().length === 0) {
      throw new ValidationError("Name is required");
    }

    const clients = await ClientService.findByName(
      name,
      req.organizationId,
      threshold || 0.6
    );

    res.json({
      success: true,
      count: clients.length,
      clients: clients,
    });
  })
);

module.exports = router;
