const { supabase } = require("../config/supabase");

/**
 * Database service for document management operations
 */
class DatabaseService {
  /**
   * Initialize database with required tables and functions
   * This should be run once during setup
   */
  static async initializeDatabase() {
    try {
      console.log("Initializing database schema...");

      // Check if basic tables exist
      const { data: tables, error } = await supabase
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_schema", "public")
        .in("table_name", ["dokumenti", "email_configurations"]);

      if (error) {
        throw new Error(`Failed to check database tables: ${error.message}`);
      }

      const tableNames = tables.map((t) => t.table_name);
      const hasDocumentiTable = tableNames.includes("dokumenti");
      const hasEmailConfigTable = tableNames.includes("email_configurations");

      console.log(`Database status:`);
      console.log(`→ dokumenti table: ${hasDocumentiTable ? "✅" : "❌"}`);
      console.log(
        `→ email_configurations table: ${hasEmailConfigTable ? "✅" : "❌"}`
      );

      if (!hasDocumentiTable) {
        console.log(
          "Core tables missing. Please run database migrations in Supabase:"
        );
        console.log(" 1. Run 001_initial_schema.sql");
        console.log(" 2. Run 002_email_integration_schema.sql");
        return false;
      }

      console.log("Database schema initialized successfully");
      return true;
    } catch (error) {
      console.error("Database initialization failed:", error.message);
      return false;
    }
  }

  /**
   * Insert a new document record
   * @param {Object} documentData - Document information
   * @returns {Promise<Object>} Created document record
   */
  static async insertDocument(documentData) {
    const {
      filename,
      originalFilename,
      documentType = "undefined",
      ocrText = "",
      extractedData = {},
      filePath,
      fileSize,
      mimeType,
      emailMetadata = {},
      userId,
    } = documentData;

    try {
      const { data, error } = await supabase
        .from("dokumenti")
        .insert({
          filename,
          original_filename: originalFilename,
          document_type: documentType,
          ocr_text: ocrText,
          extracted_data: extractedData,
          file_path: filePath,
          file_size: fileSize,
          mime_type: mimeType,
          email_metadata: emailMetadata,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to insert document: ${error.message}`);
      }

      console.log(`Document inserted: ${filename} (${documentType})`);
      return data;
    } catch (error) {
      console.error("Document insertion failed:", error.message);
      throw error;
    }
  }

  /**
   * Update document with extracted data and classification
   * @param {string} documentId - Document UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated document record
   */
  static async updateDocument(documentId, updates) {
    try {
      const { data, error } = await supabase
        .from("dokumenti")
        .update(updates)
        .eq("id", documentId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update document: ${error.message}`);
      }

      console.log(`Document updated: ${documentId}`);
      return data;
    } catch (error) {
      console.error("Document update failed:", error.message);
      throw error;
    }
  }

  /**
   * Search documents using enhanced search function
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Array>} Search results
   */
  static async searchDocuments(searchParams = {}) {
    const {
      query = "",
      documentType = null,
      dateFrom = null,
      dateTo = null,
      userId,
      limit = 50,
    } = searchParams;

    try {
      const { data, error } = await supabase
        .rpc("search_documents_enhanced", {
          search_query: query,
          doc_type: documentType,
          date_from: dateFrom,
          date_to: dateTo,
          user_id: userId,
        })
        .limit(limit);

      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }

      console.log(`Search completed: ${data.length} results for "${query}"`);
      return data;
    } catch (error) {
      console.error("Document search failed:", error.message);
      throw error;
    }
  }

  /**
   * Classify document using database function
   * @param {string} filename - Document filename
   * @param {string} content - Document content (optional)
   * @returns {Promise<string>} Document type
   */
  static async classifyDocument(filename, content = "") {
    try {
      const { data, error } = await supabase.rpc("classify_document", {
        doc_filename: filename,
        doc_content: content,
      });

      if (error) {
        throw new Error(`Classification failed: ${error.message}`);
      }

      console.log(`Document classified: "${filename}" → ${data}`);
      return data;
    } catch (error) {
      console.error("Document classification failed:", error.message);
      return "undefined";
    }
  }

  /**
   * Get document statistics for user dashboard
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Statistics object
   */
  static async getDocumentStatistics(userId) {
    try {
      const { data, error } = await supabase.rpc("get_document_statistics", {
        user_id: userId,
      });

      if (error) {
        throw new Error(`Failed to get statistics: ${error.message}`);
      }

      const stats = data[0] || {};
      console.log(`Statistics retrieved for user ${userId}`);
      return stats;
    } catch (error) {
      console.error("Statistics retrieval failed:", error.message);
      return {
        total_documents: 0,
        documents_by_type: {},
        recent_documents_count: 0,
        processing_status_count: {},
      };
    }
  }

  /**
   * Save email configuration
   * @param {Object} emailConfig - Email configuration
   * @returns {Promise<Object>} Saved configuration
   */
  static async saveEmailConfiguration(emailConfig) {
    const {
      userId,
      emailAddress,
      imapHost,
      imapPort = 993,
      useTls = true,
      mailboxName = "INBOX",
      encryptedPassword,
    } = emailConfig;

    try {
      const { data, error } = await supabase
        .from("email_configurations")
        .upsert(
          {
            user_id: userId,
            email_address: emailAddress,
            imap_host: imapHost,
            imap_port: imapPort,
            use_tls: useTls,
            mailbox_name: mailboxName,
            encrypted_password: encryptedPassword,
            is_active: true,
          },
          {
            onConflict: "user_id,email_address",
          }
        )
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save email configuration: ${error.message}`);
      }

      console.log(`Email configuration saved: ${emailAddress}`);
      return data;
    } catch (error) {
      console.error("Email configuration save failed:", error.message);
      throw error;
    }
  }

  /**
   * Get email configuration for user
   * @param {string} userId - User UUID
   * @returns {Promise<Object|null>} Email configuration
   */
  static async getEmailConfiguration(userId) {
    try {
      const { data, error } = await supabase
        .from("email_configurations")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned
          return null;
        }
        throw new Error(`Failed to get email configuration: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Email configuration retrieval failed:", error.message);
      return null;
    }
  }

  /**
   * Log email processing activity
   * @param {Object} logData - Log information
   * @returns {Promise<Object>} Created log record
   */
  static async logEmailProcessing(logData) {
    const {
      userId,
      emailConfigId,
      emailUid,
      emailSubject,
      emailFrom,
      emailDate,
      attachmentsCount = 0,
      processedAttachmentsCount = 0,
      processingStatus = "pending",
      errorMessage = null,
    } = logData;

    try {
      const { data, error } = await supabase
        .from("email_processing_logs")
        .insert({
          user_id: userId,
          email_config_id: emailConfigId,
          email_uid: emailUid,
          email_subject: emailSubject,
          email_from: emailFrom,
          email_date: emailDate,
          attachments_count: attachmentsCount,
          processed_attachments_count: processedAttachmentsCount,
          processing_status: processingStatus,
          error_message: errorMessage,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to log email processing: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Email processing log failed:", error.message);
      throw error;
    }
  }
}

module.exports = DatabaseService;
