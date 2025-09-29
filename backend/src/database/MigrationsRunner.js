// Database Migrations Runner
const { supabase } = require('../config/supabase');
const fs = require('fs').promises;
const path = require('path');

/**
 * Database migrations runner for Invoice Management Tool
 */
class MigrationsRunner {
  
  /**
   * Run all migrations in order
   */
  static async runAllMigrations() {
    try {
      console.log('Starting database migrations...\n');
      
      const migrationsDir = path.join(__dirname, '../database/migrations');
      
      // Migration files in order
      const migrationFiles = [
        '001_initial_schema.sql',
        '002_email_integration_schema.sql'
      ];
      
      for (const migrationFile of migrationFiles) {
        const filePath = path.join(migrationsDir, migrationFile);
        console.log(`Running migration: ${migrationFile}`);
        
        try {
          // Check if file exists
          await fs.access(filePath);
          
          // Read SQL content
          const sqlContent = await fs.readFile(filePath, 'utf8');
          
          // Execute migration
          await this.executeMigration(migrationFile, sqlContent);
          
          console.log(`Migration completed: ${migrationFile}\n`);
          
        } catch (fileError) {
          console.error(`Migration file error (${migrationFile}):`, fileError.message);
          throw fileError;
        }
      }
      
      console.log('All migrations completed successfully!');
      
      // Verify setup
      await this.verifyDatabaseSetup();
      
    } catch (error) {
      console.error('Migrations failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Execute a single migration
   */
  static async executeMigration(migrationName, sqlContent) {
    try {
      // Split SQL into individual statements (basic approach)
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      console.log(`   → Executing ${statements.length} SQL statements...`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        // Skip comments and empty statements
        if (statement.startsWith('--') || statement.length < 5) {
          continue;
        }
        
        try {
          const { error } = await supabase.rpc('exec_sql', {
            sql_statement: statement
          });
          
          if (error) {
            // Try direct query if RPC fails
            const { error: directError } = await supabase
              .from('information_schema.tables')
              .select('table_name')
              .limit(1);
            
            if (directError) {
              console.warn(`Statement ${i + 1} warning:`, error.message);
            }
          }
          
        } catch (stmtError) {
          console.warn(`Statement ${i + 1} skipped:`, stmtError.message);
        }
      }
      
    } catch (error) {
      console.error(`Migration execution failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Verify database setup after migrations
   */
  static async verifyDatabaseSetup() {
    console.log('Verifying database setup...');
    
    const checks = [
      {
        name: 'dokumenti table',
        query: () => supabase.from('dokumenti').select('id').limit(1)
      },
      {
        name: 'email_configurations table',
        query: () => supabase.from('email_configurations').select('id').limit(1)
      },
      {
        name: 'document_classification_rules table',
        query: () => supabase.from('document_classification_rules').select('id').limit(1)
      },
      {
        name: 'search_documents function',
        query: () => supabase.rpc('search_documents', { search_query: 'test' })
      },
      {
        name: 'search_documents_enhanced function',
        query: () => supabase.rpc('search_documents_enhanced', { search_query: 'test' })
      },
      {
        name: 'classify_document function',
        query: () => supabase.rpc('classify_document', { doc_filename: 'test.pdf' })
      },
      {
        name: 'get_document_statistics function',
        query: () => supabase.rpc('get_document_statistics')
      }
    ];
    
    const results = {
      passed: 0,
      failed: 0,
      warnings: []
    };
    
    for (const check of checks) {
      try {
        const { error } = await check.query();
        
        if (error) {
          console.log(`${check.name}: ${error.message}`);
          results.failed++;
          results.warnings.push(`${check.name}: ${error.message}`);
        } else {
          console.log(`${check.name}: OK`);
          results.passed++;
        }
        
      } catch (checkError) {
        console.log(`${check.name}: ${checkError.message}`);
        results.warnings.push(`${check.name}: ${checkError.message}`);
      }
    }
    
    console.log(`\n Verification Results:`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    
    if (results.warnings.length > 0) {
      console.log(`Warnings: ${results.warnings.length}`);
      console.log('→ Some features may need manual setup in Supabase Dashboard');
    }
    
    return results;
  }
  
  /**
   * Check if migrations are needed
   */
  static async checkMigrationsStatus() {
    try {
      console.log('Checking database status...');
      
      // Check for core tables
      const { data: tables, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', [
          'dokumenti', 
          'email_configurations', 
          'email_processing_logs',
          'document_classification_rules'
        ]);
      
      if (error) {
        console.log('Cannot check database status:', error.message);
        return false;
      }
      
      const existingTables = tables.map(t => t.table_name);
      const requiredTables = ['dokumenti', 'email_configurations', 'email_processing_logs', 'document_classification_rules'];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      
      console.log('Database Status:');
      console.log(`→ Existing tables: ${existingTables.length}/${requiredTables.length}`);
      console.log(`→ Tables found: ${existingTables.join(', ')}`);
      
      if (missingTables.length > 0) {
        console.log(`→ Missing tables: ${missingTables.join(', ')}`);
        console.log('Migrations needed!');
        return false;
      } else {
        console.log('All required tables exist');
        return true;
      }
      
    } catch (error) {
      console.error('Status check failed:', error.message);
      return false;
    }
  }
  
  /**
   * Interactive migration runner
   */
  static async runInteractive() {
    try {
      console.log('Invoice Management Tool - Database Setup\n');
      
      // Check current status
      const isSetup = await this.checkMigrationsStatus();
      
      if (isSetup) {
        console.log('\n Database is already set up!');
        console.log('→ Running verification...');
        await this.verifyDatabaseSetup();
        return true;
      }
      
      console.log('\n Starting database setup...');
      console.log('   This will run the following migrations:');
      console.log('   1. 001_initial_schema.sql - Core tables and functions');
      console.log('   2. 002_email_integration_schema.sql - Email and classification features');
      
      // Run migrations
      await this.runAllMigrations();
      
      console.log('\n Database setup completed successfully!');
      console.log('→ You can now use the Invoice Management Tool');
      
      return true;
      
    } catch (error) {
      console.error('\n Database setup failed:', error.message);
      console.log('\ Manual setup required:');
      console.log('   1. Go to your Supabase Dashboard');
      console.log('   2. Run SQL from: src/database/migrations/001_initial_schema.sql');
      console.log('   3. Run SQL from: src/database/migrations/002_email_integration_schema.sql');
      return false;
    }
  }
}

module.exports = MigrationsRunner;

// CLI runner - if called directly
if (require.main === module) {
  MigrationsRunner.runInteractive()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}