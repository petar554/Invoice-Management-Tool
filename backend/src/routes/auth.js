/**
 * Authentication Routes
 * Handles user registration, login, and organization creation
 */

const express = require("express");
const router = express.Router();
const { createClient } = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler, ValidationError } = require("../middleware/errorHandler");
const OrganizationService = require("../services/OrganizationService");

/**
 * POST /api/auth/register
 * Register new user and create their first organization
 */
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, fullName, organizationName } = req.body;

    // Validate input
    if (!email || !password || !fullName || !organizationName) {
      throw new ValidationError(
        "Email, password, full name, and organization name are required"
      );
    }

    if (password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters long");
    }

    const supabase = createClient();

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error("Failed to create user account");
    }

    // 2. Create organization with user as ORG_ADMIN
    try {
      const organization = await OrganizationService.create(
        {
          name: organizationName.trim(),
          email: email.trim().toLowerCase(),
        },
        authData.user.id
      );

      res.status(201).json({
        message: "Registration successful",
        user: {
          id: authData.user.id,
          email: authData.user.email,
          full_name: fullName.trim(),
        },
        organization: {
          id: organization.id,
          name: organization.name,
          subscription_tier: organization.subscription_tier,
          trial_ends_at: organization.trial_ends_at,
        },
        session: authData.session,
      });
    } catch (orgError) {
      // If organization creation fails, we should ideally delete the auth user
      // But Supabase doesn't allow this from client SDK
      console.error(
        "Organization creation failed after user registration:",
        orgError
      );
      throw new Error(
        "Registration partially completed. Please contact support."
      );
    }
  })
);

/**
 * POST /api/auth/login
 * Login existing user
 */
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError("Email and password are required");
    }

    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password,
    });

    if (error) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Email or password is incorrect",
      });
    }

    // Get user's organizations
    const organizations = await OrganizationService.getByUserId(data.user.id);

    res.json({
      message: "Login successful",
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name,
      },
      organizations: organizations,
      session: data.session,
    });
  })
);

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      message: "Logout successful",
    });
  })
);

/**
 * GET /api/auth/me
 * Get current user info and organizations
 */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;

    // Get user's organizations
    const organizations = await OrganizationService.getByUserId(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name,
        created_at: user.created_at,
      },
      organizations: organizations,
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw new ValidationError("Refresh token is required");
    }

    const supabase = createClient();

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refresh_token,
    });

    if (error) {
      return res.status(401).json({
        error: "Invalid refresh token",
        message: error.message,
      });
    }

    res.json({
      message: "Token refreshed successfully",
      session: data.session,
    });
  })
);

/**
 * POST /api/auth/reset-password
 * Request password reset email
 */
router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError("Email is required");
    }

    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    // Always return success to prevent email enumeration
    res.json({
      message:
        "If an account exists with this email, a password reset link has been sent",
    });
  })
);

/**
 * POST /api/auth/update-password
 * Update password (requires authentication)
 */
router.post(
  "/update-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      throw new ValidationError(
        "New password must be at least 8 characters long"
      );
    }

    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      message: "Password updated successfully",
    });
  })
);

module.exports = router;
