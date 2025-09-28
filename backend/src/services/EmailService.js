const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const EventEmitter = require('events');

class EmailService extends EventEmitter {
  constructor() {
    super();
    this.imap = null;
    this.isConnected = false;
    this.config = null;
  }

  /**
   * Configure email connection settings
   * @param {Object} config - IMAP configuration
   * @param {string} config.host - IMAP server host
   * @param {number} config.port - IMAP server port
   * @param {boolean} config.tls - Use TLS encryption
   * @param {string} config.user - Email username
   * @param {string} config.password - Email password
   * @param {string} config.mailbox - Mailbox to monitor (default: 'INBOX')
   */
  configure(config) {
    this.config = {
      host: config.host,
      port: config.port || 993,
      tls: config.tls !== false, // default to true
      user: config.user,
      password: config.password,
      mailbox: config.mailbox || 'INBOX',
      connTimeout: 60000, // connection timeout
      authTimeout: 5000,  // authentication timeout
      keepalive: true
    };

    console.log(`Email service configured for ${config.user} on ${config.host}:${this.config.port}`);
  }

  /**
   * Connect to email server
   * @returns {Promise} connection promise
   */
  async connect() {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        return reject(new Error('Email service not configured. Call configure() first.'));
      }

      if (this.isConnected) {
        console.log('Already connected to email server');
        return resolve();
      }

      this.imap = new Imap(this.config);

      // connection event handlers
      this.imap.once('ready', () => {
        console.log('Connected to email server');
        this.isConnected = true;
        this.emit('connected');
        resolve();
      });

      this.imap.once('error', (err) => {
        console.error('Email connection error:', err.message);
        this.isConnected = false;
        this.emit('error', err);
        reject(err);
      });

      this.imap.once('end', () => {
        console.log('Email connection ended');
        this.isConnected = false;
        this.emit('disconnected');
      });

      // Start connection
      console.log(`Connecting to ${this.config.host}...`);
      this.imap.connect();
    });
  }

  /**
   * Disconnect from email server
   */
  disconnect() {
    if (this.imap && this.isConnected) {
      console.log('sDisconnecting from email server...');
      this.imap.end();
      this.isConnected = false;
    }
  }

  /**
   * Open mailbox for reading
   * @param {string} mailbox - Mailbox name (default: configured mailbox)
   * @returns {Promise} Open mailbox promise
   */
  async openMailbox(mailbox = null) {
    const boxName = mailbox || this.config.mailbox;
    
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        return reject(new Error('Not connected to email server'));
      }

      this.imap.openBox(boxName, true, (err, box) => { // true = read-only mode
        if (err) {
          console.error(`Failed to open mailbox ${boxName}:`, err.message);
          reject(err);
        } else {
          console.log(`Opened mailbox: ${boxName} (${box.messages.total} messages)`);
          resolve(box);
        }
      });
    });
  }

  /**
   * Search for emails with attachments from last N days
   * @param {number} days - Number of days to look back (default: 7)
   * @returns {Promise<Array>} Array of email UIDs
   */
  async searchEmailsWithAttachments(days = 7) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        return reject(new Error('Not connected to email server'));
      }

      // calculate date for search criteria
      const since = new Date();
      since.setDate(since.getDate() - days);

      // IMAP search criteria: emails since date that have attachments
      const searchCriteria = [
        ['SINCE', since],
        ['HEADER', 'Content-Type', 'multipart'] // emails with attachments are usually multipart
      ];

      console.log(`Searching for emails with attachments from last ${days} days...`);

      this.imap.search(searchCriteria, (err, uids) => {
        if (err) {
          console.error('Email search error:', err.message);
          reject(err);
        } else {
          console.log(`Found ${uids.length} emails with potential attachments`);
          resolve(uids);
        }
      });
    });
  }

  /**
   * Fetch and parse email by UID
   * @param {number} uid - Email UID
   * @returns {Promise<Object>} Parsed email object
   */
  async fetchEmail(uid) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        return reject(new Error('Not connected to email server'));
      }

      const fetch = this.imap.fetch(uid, { bodies: '', struct: true });
      let emailData = null;

      fetch.on('message', (msg) => {
        let body = '';

        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            body += chunk.toString('utf8');
          });
        });

        msg.on('end', async () => {
          try {
            // parse email using mailparser
            const parsed = await simpleParser(body);
            
            emailData = {
              uid: uid,
              subject: parsed.subject || 'No Subject',
              from: parsed.from ? parsed.from.text : 'Unknown Sender',
              to: parsed.to ? parsed.to.text : 'Unknown Recipient',
              date: parsed.date || new Date(),
              text: parsed.text || '',
              html: parsed.html || '',
              attachments: parsed.attachments || []
            };

            console.log(`Parsed email: "${emailData.subject}" from ${emailData.from}`);
            console.log(`Attachments: ${emailData.attachments.length}`);
            
            // Log attachment details
            emailData.attachments.forEach((attachment, index) => {
              console.log(`${index + 1}. ${attachment.filename} (${attachment.size} bytes, ${attachment.contentType})`);
            });

          } catch (parseError) {
            console.error('Email parsing error:', parseError.message);
            reject(parseError);
          }
        });
      });

      fetch.once('error', (err) => {
        console.error('Email fetch error:', err.message);
        reject(err);
      });

      fetch.once('end', () => {
        if (emailData) {
          resolve(emailData);
        } else {
          reject(new Error('Failed to parse email data'));
        }
      });
    });
  }

  /**
   * Process new emails with attachments
   * @param {number} days - Number of days to look back (default: 1)
   * @returns {Promise<Array>} Array of processed emails
   */
  async processNewEmails(days = 1) {
    try {
      console.log('Starting email processing...');
      
      // open mailbox
      await this.openMailbox();
      
      // search for emails with attachments
      const uids = await this.searchEmailsWithAttachments(days);
      
      if (uids.length === 0) {
        console.log('No new emails with attachments found');
        return [];
      }

      // process each email
      const processedEmails = [];
      for (const uid of uids) {
        try {
          const email = await this.fetchEmail(uid);
          
          // only process emails with PDF, DOCX, or XML attachments
          const relevantAttachments = email.attachments.filter(att => {
            const ext = att.filename?.toLowerCase().split('.').pop();
            return ['pdf', 'docx', 'xml'].includes(ext);
          });

          if (relevantAttachments.length > 0) {
            email.attachments = relevantAttachments;
            processedEmails.push(email);
            console.log(`Processed email: "${email.subject}" (${relevantAttachments.length} relevant attachments)`);
          } else {
            console.log(`Skipped email: "${email.subject}" (no PDF/DOCX/XML attachments)`);
          }
          
        } catch (emailError) {
          console.error(`Failed to process email UID ${uid}:`, emailError.message);
        }
      }

      console.log(`Email processing complete: ${processedEmails.length} emails processed`);
      return processedEmails;

    } catch (error) {
      console.error('Email processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Test email connection and basic functionality
   * @returns {Promise<Object>} Test results
   */
  async testConnection() {
    const testResults = {
      connection: false,
      mailbox: false,
      search: false,
      error: null
    };

    try {
      // test connection
      await this.connect();
      testResults.connection = true;
      console.log('Connection test passed');

      // test mailbox access
      const box = await this.openMailbox();
      testResults.mailbox = true;
      console.log(`Mailbox test passed (${box.messages.total} messages)`);

      // test search functionality
      const uids = await this.searchEmailsWithAttachments(1);
      testResults.search = true;
      console.log(`Search test passed (${uids.length} emails found)`);

    } catch (error) {
      testResults.error = error.message;
      console.error('Email service test failed:', error.message);
    } finally {
      this.disconnect();
    }

    return testResults;
  }
}

module.exports = EmailService;