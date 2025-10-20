/**
 * Organization Service
 * Business logic for managing accounting firms (organizations)
 */

const { createClient } = require("../config/supabase");
const {
  ValidationError,
  NotFoundError,
  ConflictError,
} = require("../middleware/errorHandler");

class OrganizationService {
  /**
   * Create a new organization with the creator as ORG_ADMIN
   */
  static async create(data, creatorUserId) {
    const supabase = createClient();

    // Validate required fields
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError("Organization name is required");
    }

    if (!data.email || !this.isValidEmail(data.email)) {
      throw new ValidationError("Valid email is required");
    }

    try {
      // Check if organization with same email already exists
      const { data: existing } = await supabase
        .from("organizations")
        .select("id")
        .eq("email", data.email)
        .single();

      if (existing) {
        throw new ConflictError("Organization with this email already exists");
      }

      // Create organization with trial subscription
      const { data: organization, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          tax_id: data.tax_id?.trim() || null,
          phone: data.phone?.trim() || null,
          address: data.address?.trim() || null,
          city: data.city?.trim() || null,
          country: data.country?.trim() || "ME", // Default Montenegro
          subscription_tier: "trial",
          subscription_status: "trial",
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
          settings: data.settings || {},
          created_by: creatorUserId,
        })
        .select()
        .single();

      if (orgError) {
        console.error("Error creating organization:", orgError);
        throw new Error(orgError.message);
      }

      // Add creator as ORG_ADMIN member
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: organization.id,
          user_id: creatorUserId,
          role: "org_admin",
          is_active: true,
          joined_at: new Date().toISOString(),
        });

      if (memberError) {
        // Rollback organization creation if member creation fails
        await supabase.from("organizations").delete().eq("id", organization.id);

        console.error("Error adding organization member:", memberError);
        throw new Error("Failed to set up organization membership");
      }

      return organization;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      console.error("Organization creation error:", error);
      throw new Error("Failed to create organization");
    }
  }

  /**
   * Get all organizations for a specific user
   */
  static async getByUserId(userId) {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("organization_members")
        .select(
          `
                    role,
                    is_active,
                    joined_at,
                    organizations (
                        id,
                        name,
                        email,
                        tax_id,
                        phone,
                        subscription_tier,
                        subscription_status,
                        trial_ends_at,
                        created_at
                    )
                `
        )
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("joined_at", { ascending: false });

      if (error) {
        console.error("Error fetching user organizations:", error);
        throw new Error("Failed to fetch organizations");
      }

      // Flatten the structure
      return data.map((member) => ({
        ...member.organizations,
        user_role: member.role,
        joined_at: member.joined_at,
      }));
    } catch (error) {
      console.error("Get organizations by user error:", error);
      throw new Error("Failed to fetch organizations");
    }
  }

  /**
   * Get organization by ID
   */
  static async getById(organizationId) {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .single();

      if (error || !data) {
        throw new NotFoundError("Organization not found");
      }

      return data;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error("Get organization by ID error:", error);
      throw new Error("Failed to fetch organization");
    }
  }

  /**
   * Get organization with detailed statistics
   */
  static async getWithStats(organizationId) {
    const supabase = createClient();

    try {
      // Get organization details
      const organization = await this.getById(organizationId);

      // Get quota usage
      const { data: quotaData, error: quotaError } = await supabase.rpc(
        "get_organization_quota_usage",
        {
          p_organization_id: organizationId,
        }
      );

      if (quotaError) {
        console.error("Error fetching quota usage:", quotaError);
      }

      // Get member count
      const { count: memberCount, error: memberError } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("is_active", true);

      if (memberError) {
        console.error("Error counting members:", memberError);
      }

      return {
        ...organization,
        stats: {
          quota_usage: quotaData?.[0] || null,
          member_count: memberCount || 0,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error("Get organization with stats error:", error);
      throw new Error("Failed to fetch organization details");
    }
  }

  /**
   * Update organization
   */
  static async update(organizationId, data) {
    const supabase = createClient();

    // Build update object with only allowed fields
    const updateData = {};
    const allowedFields = [
      "name",
      "email",
      "tax_id",
      "phone",
      "address",
      "city",
      "country",
      "settings",
    ];

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError("No valid fields to update");
    }

    // Add updated timestamp
    updateData.updated_at = new Date().toISOString();

    try {
      const { data: updated, error } = await supabase
        .from("organizations")
        .update(updateData)
        .eq("id", organizationId)
        .select()
        .single();

      if (error) {
        console.error("Error updating organization:", error);
        throw new Error(error.message);
      }

      if (!updated) {
        throw new NotFoundError("Organization not found");
      }

      return updated;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      console.error("Organization update error:", error);
      throw new Error("Failed to update organization");
    }
  }

  /**
   * Get organization members
   */
  static async getMembers(organizationId) {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("organization_members")
        .select(
          `
                    user_id,
                    role,
                    is_active,
                    joined_at,
                    last_activity_at
                `
        )
        .eq("organization_id", organizationId)
        .order("joined_at", { ascending: false });

      if (error) {
        console.error("Error fetching members:", error);
        throw new Error("Failed to fetch organization members");
      }

      return data;
    } catch (error) {
      console.error("Get members error:", error);
      throw new Error("Failed to fetch organization members");
    }
  }

  /**
   * Add member to organization (invite)
   */
  static async addMember(organizationId, userId, role = "accountant") {
    const supabase = createClient();

    // Validate role
    const validRoles = ["org_admin", "accountant", "viewer", "client"];
    if (!validRoles.includes(role)) {
      throw new ValidationError(
        `Invalid role. Must be one of: ${validRoles.join(", ")}`
      );
    }

    try {
      // Check if user is already a member
      const { data: existing } = await supabase
        .from("organization_members")
        .select("id, is_active")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .single();

      if (existing) {
        if (existing.is_active) {
          throw new ConflictError(
            "User is already a member of this organization"
          );
        } else {
          // Reactivate membership
          const { data: reactivated, error } = await supabase
            .from("organization_members")
            .update({
              is_active: true,
              role: role,
              joined_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .select()
            .single();

          if (error) {
            throw new Error(error.message);
          }

          return reactivated;
        }
      }

      // Add new member
      const { data: member, error } = await supabase
        .from("organization_members")
        .insert({
          organization_id: organizationId,
          user_id: userId,
          role: role,
          is_active: true,
          joined_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding member:", error);
        throw new Error(error.message);
      }

      return member;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      console.error("Add member error:", error);
      throw new Error("Failed to add organization member");
    }
  }

  /**
   * Remove member from organization (soft delete - deactivate)
   */
  static async removeMember(organizationId, userId) {
    const supabase = createClient();

    try {
      // Check if this is the last org_admin
      const { data: admins } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("role", "org_admin")
        .eq("is_active", true);

      if (admins && admins.length === 1 && admins[0].user_id === userId) {
        throw new ValidationError(
          "Cannot remove the last admin from organization"
        );
      }

      const { data, error } = await supabase
        .from("organization_members")
        .update({ is_active: false })
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        console.error("Error removing member:", error);
        throw new Error(error.message);
      }

      if (!data) {
        throw new NotFoundError("Member not found in this organization");
      }

      return { success: true, message: "Member removed successfully" };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      console.error("Remove member error:", error);
      throw new Error("Failed to remove organization member");
    }
  }

  /**
   * Update member role
   */
  static async updateMemberRole(organizationId, userId, newRole) {
    const supabase = createClient();

    // Validate role
    const validRoles = ["org_admin", "accountant", "viewer", "client"];
    if (!validRoles.includes(newRole)) {
      throw new ValidationError(
        `Invalid role. Must be one of: ${validRoles.join(", ")}`
      );
    }

    try {
      const { data, error } = await supabase
        .from("organization_members")
        .update({ role: newRole })
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .eq("is_active", true)
        .select()
        .single();

      if (error) {
        console.error("Error updating member role:", error);
        throw new Error(error.message);
      }

      if (!data) {
        throw new NotFoundError("Active member not found in this organization");
      }

      return data;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      console.error("Update member role error:", error);
      throw new Error("Failed to update member role");
    }
  }

  /**
   * Helper: Validate email format
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Helper: Validate PIB format (Montenegro - 8 digits)
   */
  static isValidPIB(pib) {
    return /^\d{8}$/.test(pib);
  }
}

module.exports = OrganizationService;
