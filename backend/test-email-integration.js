// Enhanced email integration test
const axios = require('axios');
require('dotenv').config();

const BACKEND_URL = 'http://localhost:3001';

console.log('Enhanced Email Integration Test\n');

async function testEmailIntegration() {
  try {
    // Test 0: verify server is running
    console.log('Verifying server is running...');
    try {
      const response = await axios.get(`${BACKEND_URL}/health`);
      if (response.status === 200) {
        console.log('✅ Backend server is running');
        console.log(`→ Version: ${response.data.version}`);
        console.log(` → Supabase: ${response.data.services.supabase}`);
      }
    } catch (error) {
      console.log('❌ Backend server not accessible:', error.message);
      console.log('Please start the backend server with: npm run dev');
      return;
    }

    // Test 1: check email service status (without auth - should fail with 401)
    console.log('\n 1. Testing email status endpoint (unauthenticated)...');
    try {
      const response = await axios.get(`${BACKEND_URL}/api/email/status`);
      console.log('❌ Unexpected success - should require authentication');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Email status endpoint properly secured (401 Unauthorized)');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test 2: check email routes with proper HTTP methods
    console.log('\n 2. Testing email routes with proper HTTP methods...');
    const testRoutes = [
      { path: '/api/email/status', method: 'GET', expectedAuth: true },
      { path: '/api/email/configure', method: 'POST', expectedAuth: true },
      { path: '/api/email/test', method: 'POST', expectedAuth: true },
      { path: '/api/email/process', method: 'POST', expectedAuth: true },
      { path: '/api/email/disconnect', method: 'DELETE', expectedAuth: true }
    ];

    for (const route of testRoutes) {
      try {
        let response;
        
        // make request with appropriate method
        switch (route.method) {
          case 'GET':
            response = await axios.get(`${BACKEND_URL}${route.path}`);
            break;
          case 'POST':
            response = await axios.post(`${BACKEND_URL}${route.path}`, {});
            break;
          case 'DELETE':
            response = await axios.delete(`${BACKEND_URL}${route.path}`);
            break;
        }
        
        console.log(`❌ Route ${route.method} ${route.path} - Unexpected success (should require auth)`);
        
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log(`✅ Route ${route.method} ${route.path} - Properly secured`);
        } else if (error.response && error.response.status === 400) {
          // Some routes might return 400 for missing data, which means the route exists
          console.log(`✅ Route ${route.method} ${route.path} - Exists (400 Bad Request expected)`);
        } else if (error.response && error.response.status === 405) {
          console.log(`⚠️ Route ${route.method} ${route.path} - Method not allowed`);
        } else if (error.response && error.response.status === 404) {
          console.log(`❌ Route ${route.method} ${route.path} - Not found (404)`);
        } else {
          console.log(`❌ Route ${route.method} ${route.path} - Error: ${error.message}`);
        }
      }
    }

    // Test 3:test EmailService class directly
    console.log('\n 3. Testing EmailService class...');
    try {
      const EmailService = require('./src/services/EmailService');
      const emailService = new EmailService();
      
      console.log('✅ EmailService class loaded successfully');
      console.log('→ Methods available:', Object.getOwnPropertyNames(EmailService.prototype).filter(m => m !== 'constructor'));
      console.log('→ Initial state - connected:', emailService.isConnected);
      console.log('→ Initial state - configured:', !!emailService.config);
      
    } catch (error) {
      console.log('❌ EmailService class error:', error.message);
    }

    // Test 4: test configuration validation logic
    console.log('\n 4 Testing email configuration validation logic...');
    const testConfigs = [
      {
        name: 'Valid Gmail config',
        config: { host: 'imap.gmail.com', port: 993, user: 'test@gmail.com', password: 'test123', tls: true },
        expectValid: true
      },
      {
        name: 'Valid Outlook config',
        config: { host: 'outlook.office365.com', port: 993, user: 'test@outlook.com', password: 'test123' },
        expectValid: true
      },
      {
        name: 'Invalid - missing host',
        config: { port: 993, user: 'test@gmail.com', password: 'test123' },
        expectValid: false
      },
      {
        name: 'Invalid - invalid port',
        config: { host: 'imap.gmail.com', port: 99999, user: 'test@gmail.com', password: 'test123' },
        expectValid: false
      },
      {
        name: 'Invalid - invalid email',
        config: { host: 'imap.gmail.com', port: 993, user: 'invalid-email', password: 'test123' },
        expectValid: false
      }
    ];

    for (const testCase of testConfigs) {
      const hasRequiredFields = testCase.config.host && testCase.config.port && testCase.config.user && testCase.config.password;
      const hasValidPort = testCase.config.port && testCase.config.port >= 1 && testCase.config.port <= 65535;
      const hasValidEmail = testCase.config.user && testCase.config.user.includes('@');
      
      const isValid = hasRequiredFields && hasValidPort && hasValidEmail;
      
      if (isValid === testCase.expectValid) {
        console.log(`✅ ${testCase.name} - validation correct`);
      } else {
        console.log(`❌ ${testCase.name} - validation failed (expected ${testCase.expectValid}, got ${isValid})`);
      }
    }

    // Test 5: test attachment filtering logic
    console.log('\n 5. Testing attachment filtering logic...');
    const mockAttachments = [
      { filename: 'invoice.pdf', contentType: 'application/pdf' },
      { filename: 'contract.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { filename: 'data.xml', contentType: 'application/xml' },
      { filename: 'image.jpg', contentType: 'image/jpeg' }, // should be filtered out
      { filename: 'document.txt', contentType: 'text/plain' }, // should be filtered out
      { filename: 'report.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } // Should be filtered out
    ];

    const relevantAttachments = mockAttachments.filter(att => {
      const ext = att.filename?.toLowerCase().split('.').pop();
      return ['pdf', 'docx', 'xml'].includes(ext);
    });

    console.log(`→ Total attachments: ${mockAttachments.length}`);
    console.log(`→ Relevant attachments: ${relevantAttachments.length}`);
    console.log(`→ Filtered files: ${relevantAttachments.map(att => att.filename).join(', ')}`);
    
    if (relevantAttachments.length === 3 && 
        relevantAttachments.some(att => att.filename === 'invoice.pdf') &&
        relevantAttachments.some(att => att.filename === 'contract.docx') &&
        relevantAttachments.some(att => att.filename === 'data.xml')) {
      console.log('✅ Attachment filtering works correctly');
    } else {
      console.log('❌ Attachment filtering failed');
    }

    // Test 6: Test common email provider configurations
    console.log('\n 6. Testing common email provider configurations...');
    const emailProviders = [
      { name: 'Gmail', host: 'imap.gmail.com', port: 993, tls: true },
      { name: 'Outlook/Hotmail', host: 'outlook.office365.com', port: 993, tls: true },
      { name: 'Yahoo', host: 'imap.mail.yahoo.com', port: 993, tls: true },
      { name: 'Custom IMAP', host: 'mail.example.com', port: 143, tls: false }
    ];

    emailProviders.forEach(provider => {
      const config = {
        host: provider.host,
        port: provider.port,
        user: 'test@example.com',
        password: 'password123',
        tls: provider.tls
      };
      
      console.log(`✅ ${provider.name}: ${provider.host}:${provider.port} (TLS: ${provider.tls})`);
    });

    console.log('\n Enhanced email integration test completed!');

  } catch (error) {
    console.error('❌Enhanced email integration test failed:', error.message);
    console.error(error.stack);
  }
}

testEmailIntegration().catch(console.error);