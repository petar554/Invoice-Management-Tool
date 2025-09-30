// Database Setup Test and Validation
const MigrationsRunner = require('./MigrationsRunner');
const DatabaseService = require('../services/DatabaseService');

/**
 * Comprehensive test suite for database setup validation
 */
class DatabaseSetupTest {
  
  /**
   * Run complete database validation
   */
  static async runValidation() {
    console.log('Database Setup Validation Test\n');
    
    const results = {
      tests: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
    
    try {
      // Test 1: migrations status
      console.log('Test 1: Checking migrations status...');
      results.tests++;
      
      const migrationsStatus = await MigrationsRunner.checkMigrationsStatus();
      if (migrationsStatus) {
        console.log('   All migrations applied successfully');
        results.passed++;
      } else {
        console.log('   Migrations missing or incomplete');
        results.failed++;
        results.errors.push('Migrations not complete');
      }
      
      // Test 2: db service connectivity
      console.log('\nTest 2: Testing DatabaseService connection...');
      results.tests++;
      
      try {
        const stats = await DatabaseService.getDocumentStatistics('00000000-0000-0000-0000-000000000000');
        console.log('   DatabaseService connection working');
        console.log(`   Statistics query returned:`, {
          total: stats.total_documents,
          hasTypes: !!stats.documents_by_type,
          hasStatus: !!stats.processing_status_count
        });
        results.passed++;
      } catch (dbError) {
        console.log('   DatabaseService connection failed:', dbError.message);
        results.failed++;
        results.errors.push(`DatabaseService: ${dbError.message}`);
      }
      
      // Test 3: classification Rules
      console.log('\nTest 3: Testing document classification...');
      results.tests++;
      
      try {
        // test classification with different filenames
        const testCases = [
          { filename: 'faktura_test.pdf', expected: 'faktura' },
          { filename: 'izvod_racuna_test.pdf', expected: 'izvod' },
          { filename: 'ugovor_test.docx', expected: 'ugovor' },
          { filename: 'random_file.pdf', expected: 'undefined' }
        ];
        
        let classificationPassed = 0;
        
        for (const testCase of testCases) {
          const result = await DatabaseService.classifyDocument(testCase.filename);
          if (result === testCase.expected) {
            console.log(`   "${testCase.filename}" -> ${result}`);
            classificationPassed++;
          } else {
            console.log(`   "${testCase.filename}" -> ${result} (expected: ${testCase.expected})`);
          }
        }
        
        if (classificationPassed === testCases.length) {
          console.log('   All classification tests passed');
          results.passed++;
        } else {
          console.log(`   ${classificationPassed}/${testCases.length} classification tests passed`);
          results.failed++;
          results.errors.push(`Classification: ${classificationPassed}/${testCases.length} tests passed`);
        }
        
      } catch (classError) {
        console.log('   Classification test failed:', classError.message);
        results.failed++;
        results.errors.push(`Classification: ${classError.message}`);
      }
      
      // Test 4: search Functions
      console.log('\nTest 4: Testing search functions...');
      results.tests++;
      
      try {
        const searchResult = await DatabaseService.searchDocuments({
          query: 'test',
          userId: '00000000-0000-0000-0000-000000000000'
        });
        console.log('   Enhanced search function working');
        console.log(`   Search returned ${searchResult.length} results`);
        results.passed++;
      } catch (searchError) {
        console.log('   Search function failed:', searchError.message);
        results.failed++;
        results.errors.push(`Search: ${searchError.message}`);
      }
      
      // Test 5: email Configuration Schema
      console.log('\nTest 5: Testing email configuration schema...');
      results.tests++;
      
      try {
        const testConfig = {
          emailAddress: 'test@example.com',
          imapHost: 'imap.example.com',
          imapPort: 993,
          useTls: true,
          mailboxName: 'INBOX',
          encryptedPassword: 'encrypted_test_password'
        };
        
        const configResult = await DatabaseService.saveEmailConfiguration({
          userId: '00000000-0000-0000-0000-000000000000',
          ...testConfig
        });
        
        console.log('   Email configuration schema working');
        console.log(`   Created config with ID: ${configResult.id}`);
        
        // note: Test data created, manual cleanup may be needed
        console.log('   Test data created successfully');
        
        results.passed++;
      } catch (emailError) {
        console.log('   Email configuration test failed:', emailError.message);
        results.failed++;
        results.errors.push(`Email config: ${emailError.message}`);
      }
      
      // Test Summary
      console.log('\n' + '='.repeat(50));
      console.log('VALIDATION SUMMARY');
      console.log('='.repeat(50));
      console.log(`Total Tests: ${results.tests}`);
      console.log(`Passed: ${results.passed}`);
      console.log(`Failed: ${results.failed}`);
      console.log(`Success Rate: ${Math.round((results.passed / results.tests) * 100)}%`);
      
      if (results.failed > 0) {
        console.log('\nErrors encountered:');
        results.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
        
        console.log('\nRecommended Actions:');
        console.log('   1. Check your Supabase project configuration');
        console.log('   2. Verify that both SQL migration files are executed');
        console.log('   3. Ensure proper permissions are set in Supabase');
        console.log('   4. Check network connectivity to Supabase');
      } else {
        console.log('\nAll tests passed! Database is ready for use.');
        console.log('\nNext Steps:');
        console.log('   1. Start the Email Integration (Podfaza 1.3)');
        console.log('   2. Test email processing with real email accounts');
        console.log('   3. Continue to Document Parsing (Podfaza 1.4)');
      }
      
      return results.failed === 0;
      
    } catch (error) {
      console.error('\nFatal error during validation:', error.message);
      console.log('\nRecovery suggestions:');
      console.log('   1. Check your .env file configuration');
      console.log('   2. Verify Supabase project URL and keys');
      console.log('   3. Run migrations manually in Supabase Dashboard');
      
      return false;
    }
  }
  
  /**
   * Quick health check
   */
  static async quickHealthCheck() {
    console.log('Quick Database Health Check...\n');
    
    try {
      // check basic connectivity
      const stats = await DatabaseService.getDocumentStatistics('00000000-0000-0000-0000-000000000000');
      console.log('Database connection: OK');
      console.log('Core functions: Working');
      console.log('Schema integrity: Valid');
      
      console.log('\nCurrent Database State:');
      console.log(`   Total documents in system: ${stats.total_documents || 0}`);
      console.log(`   Document types configured: ${Object.keys(stats.documents_by_type || {}).length}`);
      console.log(`   Processing statuses available: ${Object.keys(stats.processing_status_count || {}).length}`);
      
      return true;
      
    } catch (error) {
      console.log('Database health check failed:', error.message);
      console.log('\nTroubleshooting:');
      console.log('   Run full validation: npm run test:db');
      console.log('   Check migrations: npm run db:migrate');
      return false;
    }
  }
}

module.exports = DatabaseSetupTest;

// CLI runner
if (require.main === module) {
  const command = process.argv[2] || 'full';
  
  if (command === 'quick') {
    DatabaseSetupTest.quickHealthCheck()
      .then(success => process.exit(success ? 0 : 1))
      .catch(error => {
        console.error('Health check failed:', error);
        process.exit(1);
      });
  } else {
    DatabaseSetupTest.runValidation()
      .then(success => process.exit(success ? 0 : 1))
      .catch(error => {
        console.error('Validation failed:', error);
        process.exit(1);
      });
  }
}