/**
 * Organization Routes
 * Handles CRUD operations for accounting firms (organizations)
 */

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const {
  checkOrgMembership,
  requireRole,
} = require("../middleware/authorization");
const { asyncHandler, ValidationError } = require("../middleware/errorHandler");
const OrganizationService = require("../services/OrganizationService");

/**
 * GET /api/organizations/my
 * Get all organizations for current user
 */
router.get(
  "/my",
  requireAuth,
  asyncHandler(async (req, res) => {
    const organizations = await OrganizationService.getByUserId(req.user.id);

    res.json({
      success: true,
      count: organizations.length,
      organizations: organizations,
    });
  })
);

/**
 * POST /api/organizations
 * Create a new organization
 */
router.post(
  "/",
  requireAuth,
  requireRole(["org_admin", "accountant"]),
  asyncHandler(async (req, res) => {
    const organization = await OrganizationService.create(
      req.body,
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: "Organization created successfully",
      organization: organization,
    });
  })
);

/**
 * GET /api/organizations/:id
 * Get organization details
 */
router.get(
  "/:id",
  requireAuth,
  checkOrgMembership,
  asyncHandler(async (req, res) => {
    const organization = await OrganizationService.getById(req.params.id);

    res.json({
      success: true,
      organization: organization,
    });
  })
);

/**
 * GET /api/organizations/:id/stats
 * Get organization with detailed statistics
 */
router.get(
  "/:id/stats",
  requireAuth,
  checkOrgMembership,
  asyncHandler(async (req, res) => {
    const organization = await OrganizationService.getWithStats(req.params.id);

    res.json({
      success: true,
      organization: organization,
    });
  })
);

/**
 * PUT /api/organizations/:id
 * Update organization (admin only)
 */
router.put(
  "/:id",
  requireAuth,
  checkOrgMembership,
  requireRole(["org_admin"]),
  asyncHandler(async (req, res) => {
    const updated = await OrganizationService.update(req.params.id, req.body);

    res.json({
      success: true,
      message: "Organization updated successfully",
      organization: updated,
    });
  })
);

/**
 * GET /api/organizations/:id/members
 * Get organization members
 */
router.get(
  "/:id/members",
  requireAuth,
  checkOrgMembership,
  asyncHandler(async (req, res) => {
    const members = await OrganizationService.getMembers(req.params.id);

    res.json({
      success: true,
      count: members.length,
      members: members,
    });
  })
);

/**
 * POST /api/organizations/:id/members
 * Add member to organization (admin only)
 */
router.post(
  "/:id/members",
  requireAuth,
  checkOrgMembership,
  requireRole(["org_admin"]),
  asyncHandler(async (req, res) => {
    const { user_id, role } = req.body;

    if (!user_id) {
      throw new ValidationError("User ID is required");
    }

    const member = await OrganizationService.addMember(
      req.params.id,
      user_id,
      role || "accountant"
    );

    res.status(201).json({
      success: true,
      message: "Member added successfully",
      member: member,
    });
  })
);

/**
 * DELETE /api/organizations/:id/members/:userId
 * Remove member from organization (admin only)
 */
router.delete(
  "/:id/members/:userId",
  requireAuth,
  checkOrgMembership,
  requireRole(["org_admin"]),
  asyncHandler(async (req, res) => {
    const result = await OrganizationService.removeMember(
      req.params.id,
      req.params.userId
    );

    res.json({
      success: true,
      message: result.message,
    });
  })
);

/**
 * PATCH /api/organizations/:id/members/:userId/role
 * Update member role (admin only)
 */
router.patch(
  "/:id/members/:userId/role",
  requireAuth,
  checkOrgMembership,
  requireRole(["org_admin"]),
  asyncHandler(async (req, res) => {
    const { role } = req.body;

    if (!role) {
      throw new ValidationError("Role is required");
    }

    const updated = await OrganizationService.updateMemberRole(
      req.params.id,
      req.params.userId,
      role
    );

    res.json({
      success: true,
      message: "Member role updated successfully",
      member: updated,
    });
  })
);

module.exports = router;
