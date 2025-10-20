/**
 * Client Service
 * Business logic for managing clients (customers of accounting firms)
 */

const { createClient: createSupabaseClient } = require("../config/supabase");
const {
  ValidationError,
  NotFoundError,
  ConflictError,
} = require("../middleware/errorHandler");

class ClientService {
  /**
   * Create a new client
   */
  static async create(data, organizationId, createdBy) {
    const supabase = createSupabaseClient();

    // Validate required fields
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError("Client name is required");
    }

    if (!data.tax_id || data.tax_id.trim().length < 8) {
      throw new ValidationError(
        "Valid tax ID (PIB) is required - minimum 8 characters"
      );
    }

    // Validate PIB format for Montenegro (8 digits)
    if (!/^\d{8,13}$/.test(data.tax_id.trim())) {
      throw new ValidationError("Tax ID must be 8-13 digits for Montenegro");
    }

    try {
      // Check if client with same PIB already exists in this organization
      const { data: existing } = await supabase
        .from("clients")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("tax_id", data.tax_id.trim())
        .single();

      if (existing) {
        throw new ConflictError(
          `Client with PIB ${data.tax_id} already exists: ${existing.name}`
        );
      }

      // Prepare client data
      const clientData = {
        organization_id: organizationId,
        name: data.name.trim(),
        tax_id: data.tax_id.trim(),
        alternative_names: data.alternative_names || [],
        email: data.email?.trim().toLowerCase() || null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        industry: data.industry?.trim() || null,
        company_size: data.company_size || null,
        assigned_accountant_id: data.assigned_accountant_id || null,
        portal_enabled: data.portal_enabled || false,
        portal_user_id: data.portal_user_id || null,
        notification_preferences: data.notification_preferences || {},
        custom_fields: data.custom_fields || {},
        is_active: true,
        created_by: createdBy,
      };

      const { data: client, error } = await supabase
        .from("clients")
        .insert(clientData)
        .select()
        .single();

      if (error) {
        console.error("Error creating client:", error);
        throw new Error(error.message);
      }

      return client;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      console.error("Client creation error:", error);
      throw new Error("Failed to create client");
    }
  }

  /**
   * Get all clients for an organization
   */
  static async getByOrganization(organizationId, filters = {}) {
    const supabase = createSupabaseClient();

    try {
      let query = supabase
        .from("clients")
        .select("*")
        .eq("organization_id", organizationId);

      // Apply filters
      if (filters.is_active !== undefined) {
        query = query.eq("is_active", filters.is_active);
      }

      if (filters.assigned_accountant_id) {
        query = query.eq(
          "assigned_accountant_id",
          filters.assigned_accountant_id
        );
      }

      if (filters.city) {
        query = query.eq("city", filters.city);
      }

      if (filters.industry) {
        query = query.eq("industry", filters.industry);
      }

      // Search by name or tax_id
      if (filters.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,tax_id.ilike.%${filters.search}%`
        );
      }

      // Ordering
      const orderBy = filters.orderBy || "name";
      const orderDirection = filters.orderDirection || "asc";
      query = query.order(orderBy, { ascending: orderDirection === "asc" });

      // Pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(
          filters.offset,
          filters.offset + (filters.limit || 50) - 1
        );
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("Error fetching clients:", error);
        throw new Error("Failed to fetch clients");
      }

      return {
        clients: data,
        count: count,
        page: filters.offset
          ? Math.floor(filters.offset / (filters.limit || 50)) + 1
          : 1,
        limit: filters.limit || 50,
      };
    } catch (error) {
      console.error("Get clients error:", error);
      throw new Error("Failed to fetch clients");
    }
  }

  /**
   * Get client by ID
   */
  static async getById(clientId, organizationId) {
    const supabase = createSupabaseClient();

    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .eq("organization_id", organizationId) // Security: ensure org ownership
        .single();

      if (error || !data) {
        throw new NotFoundError("Client not found");
      }

      return data;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error("Get client by ID error:", error);
      throw new Error("Failed to fetch client");
    }
  }

  /**
   * Get client with statistics (document counts, etc.)
   */
  static async getWithStats(clientId, organizationId) {
    const supabase = createSupabaseClient();

    try {
      // Get client details
      const client = await this.getById(clientId, organizationId);

      // Get document statistics
      const { data: docStats, error: docError } = await supabase
        .from("dokumenti")
        .select("document_type, document_status")
        .eq("client_id", clientId);

      if (docError) {
        console.error("Error fetching document stats:", docError);
      }

      // Calculate statistics
      const stats = {
        total_documents: docStats?.length || 0,
        by_type: {},
        by_status: {},
      };

      if (docStats) {
        docStats.forEach((doc) => {
          // Count by type
          stats.by_type[doc.document_type] =
            (stats.by_type[doc.document_type] || 0) + 1;
          // Count by status
          stats.by_status[doc.document_status] =
            (stats.by_status[doc.document_status] || 0) + 1;
        });
      }

      return {
        ...client,
        stats,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error("Get client with stats error:", error);
      throw new Error("Failed to fetch client details");
    }
  }

  /**
   * Update client
   */
  static async update(clientId, organizationId, data) {
    const supabase = createSupabaseClient();

    // Build update object with only allowed fields
    const updateData = {};
    const allowedFields = [
      "name",
      "tax_id",
      "alternative_names",
      "email",
      "phone",
      "address",
      "city",
      "industry",
      "company_size",
      "assigned_accountant_id",
      "portal_enabled",
      "portal_user_id",
      "notification_preferences",
      "custom_fields",
      "is_active",
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
        .from("clients")
        .update(updateData)
        .eq("id", clientId)
        .eq("organization_id", organizationId) // Security: ensure org ownership
        .select()
        .single();

      if (error) {
        console.error("Error updating client:", error);
        throw new Error(error.message);
      }

      if (!updated) {
        throw new NotFoundError("Client not found");
      }

      return updated;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      console.error("Client update error:", error);
      throw new Error("Failed to update client");
    }
  }

  /**
   * Delete client (soft delete - deactivate)
   */
  static async delete(clientId, organizationId) {
    const supabase = createSupabaseClient();

    try {
      const { data, error } = await supabase
        .from("clients")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .eq("organization_id", organizationId) // Security: ensure org ownership
        .select()
        .single();

      if (error) {
        console.error("Error deleting client:", error);
        throw new Error(error.message);
      }

      if (!data) {
        throw new NotFoundError("Client not found");
      }

      return { success: true, message: "Client deactivated successfully" };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error("Client delete error:", error);
      throw new Error("Failed to delete client");
    }
  }

  /**
   * Find client by Tax ID (PIB) - Used by OCR routing
   */
  static async findByTaxId(taxId, organizationId) {
    const supabase = createSupabaseClient();

    try {
      const { data, error } = await supabase.rpc("find_client_by_tax_id", {
        p_tax_id: taxId.trim(),
        p_organization_id: organizationId,
      });

      if (error) {
        console.error("Error finding client by tax ID:", error);
        throw new Error("Failed to find client");
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error("Find client by tax ID error:", error);
      throw new Error("Failed to find client");
    }
  }

  /**
   * Find client by name (fuzzy matching) - Used by OCR routing fallback
   */
  static async findByName(name, organizationId, threshold = 0.6) {
    const supabase = createSupabaseClient();

    try {
      const { data, error } = await supabase.rpc("find_client_by_name", {
        p_name: name.trim(),
        p_organization_id: organizationId,
        p_threshold: threshold,
      });

      if (error) {
        console.error("Error finding client by name:", error);
        throw new Error("Failed to find client");
      }

      return data && data.length > 0 ? data : [];
    } catch (error) {
      console.error("Find client by name error:", error);
      throw new Error("Failed to find client");
    }
  }

  /**
   * Search clients (combines tax_id and name search)
   */
  static async search(organizationId, searchTerm) {
    const supabase = createSupabaseClient();

    try {
      // Try exact PIB match first
      if (/^\d{8,13}$/.test(searchTerm.trim())) {
        const pibMatch = await this.findByTaxId(searchTerm, organizationId);
        if (pibMatch) {
          return [{ ...pibMatch, match_type: "tax_id_exact", confidence: 1.0 }];
        }
      }

      // Fallback to name fuzzy matching
      const nameMatches = await this.findByName(searchTerm, organizationId);
      return nameMatches.map((match) => ({
        ...match,
        match_type: "name_fuzzy",
      }));
    } catch (error) {
      console.error("Search clients error:", error);
      throw new Error("Failed to search clients");
    }
  }

  /**
   * Get client's documents
   */
  static async getDocuments(clientId, organizationId, filters = {}) {
    const supabase = createSupabaseClient();

    try {
      // First verify client belongs to organization
      await this.getById(clientId, organizationId);

      let query = supabase
        .from("dokumenti")
        .select("*")
        .eq("client_id", clientId)
        .eq("organization_id", organizationId);

      // Apply filters
      if (filters.document_type) {
        query = query.eq("document_type", filters.document_type);
      }

      if (filters.document_status) {
        query = query.eq("document_status", filters.document_status);
      }

      if (filters.date_from) {
        query = query.gte("created_at", filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte("created_at", filters.date_to);
      }

      // Ordering
      query = query.order("created_at", { ascending: false });

      // Pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching client documents:", error);
        throw new Error("Failed to fetch documents");
      }

      return data;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error("Get client documents error:", error);
      throw new Error("Failed to fetch client documents");
    }
  }

  /**
   * Assign accountant to client
   */
  static async assignAccountant(clientId, organizationId, accountantId) {
    const supabase = createSupabaseClient();

    try {
      // Verify accountant is a member of the organization
      const { data: member } = await supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", accountantId)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .single();

      if (!member || !["org_admin", "accountant"].includes(member.role)) {
        throw new ValidationError(
          "Accountant must be an active member with accountant or admin role"
        );
      }

      const { data, error } = await supabase
        .from("clients")
        .update({
          assigned_accountant_id: accountantId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .eq("organization_id", organizationId)
        .select()
        .single();

      if (error) {
        console.error("Error assigning accountant:", error);
        throw new Error(error.message);
      }

      if (!data) {
        throw new NotFoundError("Client not found");
      }

      return data;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      console.error("Assign accountant error:", error);
      throw new Error("Failed to assign accountant");
    }
  }
}

module.exports = ClientService;
