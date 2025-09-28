const express = require('express');
const { body, validationResult } = require('express-validator');
const EmailService = require('../services/EmailService');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Single instance of EmailService to maintain connection state
let emailService = null;

/**
 * Initialize email service if not already initialized
 */
const getEmailService = () => {
  if (!emailService) {
    emailService = new EmailService();
  }
  return emailService;
};

/**
 * POST /api/email/configure
 * Configure email IMAP settings
 */
router.post('/configure', 
  authMiddleware,
  [
    body('host').notEmpty().withMessage('Email host is required'),
    body('port').isInt({ min: 1, max: 65535 }).withMessage('Valid port number is required'),
    body('user').isEmail().withMessage('Valid email address is required'),
    body('password').notEmpty().withMessage('Email password is required'),
    body('tls').optional().isBoolean().withMessage('TLS must be boolean'),
    body('mailbox').optional().isString().withMessage('Mailbox must be string')
  ],
  async (req, res) => {
    try {
      //check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { host, port, user, password, tls = true, mailbox = 'INBOX' } = req.body;

      //get email service instance
      const service = getEmailService();

      //configure email service
      service.configure({
        host,
        port: parseInt(port),
        user,
        password,
        tls,
        mailbox
      });

      console.log(`Email configured for user ${user} on ${host}:${port}`);

      res.json({
        success: true,
        message: 'Email configuration saved successfully',
        config: {
          host,
          port: parseInt(port),
          user,
          tls,
          mailbox,
          // do not return password for security
          passwordSet: !!password
        }
      });

    } catch (error) {
      console.error('Email configuration error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to configure email settings',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/email/test
 * Test email connection
 */
router.post('/test', 
  authMiddleware,
  async (req, res) => {
    try {
      const service = getEmailService();

      if (!service.config) {
        return res.status(400).json({
          success: false,
          message: 'Email not configured. Please configure email settings first.'
        });
      }

      console.log('Testing email connection...');
      const testResults = await service.testConnection();

      if (testResults.error) {
        return res.status(400).json({
          success: false,
          message: 'Email connection test failed',
          results: testResults
        });
      }

      res.json({
        success: true,
        message: 'Email connection test successful',
        results: testResults
      });

    } catch (error) {
      console.error('Email test error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Email test failed',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/email/status
 * Get email service status
 */
router.get('/status', 
  authMiddleware,
  async (req, res) => {
    try {
      const service = getEmailService();

      const status = {
        configured: !!service.config,
        connected: service.isConnected,
        config: service.config ? {
          host: service.config.host,
          port: service.config.port,
          user: service.config.user,
          tls: service.config.tls,
          mailbox: service.config.mailbox
          // don't expose password
        } : null
      };

      res.json({
        success: true,
        status
      });

    } catch (error) {
      console.error('Email status error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to get email status',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/email/process
 * Process new emails with attachments
 */
router.post('/process', 
  authMiddleware,
  [
    body('days').optional().isInt({ min: 1, max: 30 }).withMessage('Days must be between 1 and 30')
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const service = getEmailService();

      if (!service.config) {
        return res.status(400).json({
          success: false,
          message: 'Email not configured. Please configure email settings first.'
        });
      }

      const { days = 1 } = req.body;

      console.log(`Processing emails from last ${days} days...`);

      // Connect to email server
      await service.connect();

      try {
        // Process emails
        const processedEmails = await service.processNewEmails(days);

        res.json({
          success: true,
          message: `Successfully processed ${processedEmails.length} emails`,
          data: {
            emailsProcessed: processedEmails.length,
            emails: processedEmails.map(email => ({
              uid: email.uid,
              subject: email.subject,
              from: email.from,
              date: email.date,
              attachments: email.attachments.map(att => ({
                filename: att.filename,
                size: att.size,
                contentType: att.contentType
              }))
            }))
          }
        });

      } finally {
        // Always disconnect
        service.disconnect();
      }

    } catch (error) {
      console.error('Email processing error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to process emails',
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/email/disconnect
 * Disconnect from email server
 */
router.delete('/disconnect', 
  authMiddleware,
  async (req, res) => {
    try {
      const service = getEmailService();

      if (service.isConnected) {
        service.disconnect();
        console.log('📧 Email service disconnected');
      }

      res.json({
        success: true,
        message: 'Email service disconnected'
      });

    } catch (error) {
      console.error('Email disconnect error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect email service',
        error: error.message
      });
    }
  }
);

module.exports = router;