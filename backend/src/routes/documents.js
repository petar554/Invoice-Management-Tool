const express = require('express')
const multer = require('multer')
const { body, query, validationResult } = require('express-validator')
const { supabaseAdmin } = require('../config/supabase')
const authMiddleware = require('../middleware/auth')

const router = express.Router()

//multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,xml').split(',')
    const fileExtension = file.originalname.split('.').pop().toLowerCase()
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true)
    } else {
      cb(new Error(`File type .${fileExtension} not allowed. Allowed types: ${allowedTypes.join(', ')}`))
    }
  }
})

//validation middleware
const validateInput = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    })
  }
  next()
}

//apply authentication middleware to all routes
router.use(authMiddleware)

// get all documents with pagination and filtering
router.get('/', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('type')
    .optional()
    .isIn(['faktura', 'izvod', 'ugovor', 'undefined'])
    .withMessage('Invalid document type'),
  query('status')
    .optional()
    .isIn(['pending', 'processed', 'error'])
    .withMessage('Invalid document status'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
], validateInput, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      search,
      startDate,
      endDate
    } = req.query

    const offset = (page - 1) * limit
    const userId = req.user.id

    let query = supabaseAdmin
      .from('dokumenti')
      .select(`
        id,
        filename,
        original_filename,
        document_type,
        document_status,
        extracted_data,
        file_size,
        mime_type,
        created_at,
        updated_at
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    //apply filters
    if (type) {
      query = query.eq('document_type', type)
    }
    if (status) {
      query = query.eq('document_status', status)
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    //execute query
    const { data: documents, error, count } = await query

    if (error) {
      throw error
    }

    // if search is provided- than use the search function
    let searchResults = documents
    if (search) {
      const { data: searchData, error: searchError } = await supabaseAdmin
        .rpc('search_documents', { 
          search_query: search,
          user_id: userId 
        })

      if (searchError) {
        throw searchError
      }
      searchResults = searchData
    }

    res.json({
      success: true,
      data: searchResults,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const { data: document, error } = await supabaseAdmin
      .from('dokumenti')
      .select('*')
      .eq('id', id)
      .eq('created_by', userId)
      .single()

    if (error || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    res.json({
      success: true,
      data: document
    })
  } catch (error) {
    next(error)
  }
})

//upload documents
router.post('/upload', upload.array('documents', 5), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      })
    }

    const userId = req.user.id
    const uploadedDocuments = []

    for (const file of req.files) {
      try {
        // generate unique filename
        const timestamp = Date.now()
        const randomString = Math.random().toString(36).substring(2, 15)
        const fileExtension = file.originalname.split('.').pop()
        const filename = `${timestamp}_${randomString}.${fileExtension}`
        const filePath = `${userId}/${filename}`

        //upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('documents')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            cacheControl: '3600'
          })

        if (uploadError) {
          throw uploadError
        }

        // save document metadata to database
        const { data: documentData, error: dbError } = await supabaseAdmin
          .from('dokumenti')
          .insert({
            filename,
            original_filename: file.originalname,
            file_path: uploadData.path,
            file_size: file.size,
            mime_type: file.mimetype,
            created_by: userId
          })
          .select()
          .single()

        if (dbError) {
          //clean up uploaded file if database insert fails
          await supabaseAdmin.storage
            .from('documents')
            .remove([filePath])
          throw dbError
        }

        uploadedDocuments.push(documentData)
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError)
        // continue with other files, don't fail the entire request
      }
    }

    if (uploadedDocuments.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process any files'
      })
    }

    res.status(201).json({
      success: true,
      message: `Successfully uploaded ${uploadedDocuments.length} documents`,
      data: uploadedDocuments
    })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    //get document info first
    const { data: document, error: fetchError } = await supabaseAdmin
      .from('dokumenti')
      .select('file_path')
      .eq('id', id)
      .eq('created_by', userId)
      .single()

    if (fetchError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    //delete from storage
    if (document.file_path) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('documents')
        .remove([document.file_path])

      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
      }
    }

    //delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('dokumenti')
      .delete()
      .eq('id', id)
      .eq('created_by', userId)

    if (deleteError) {
      throw deleteError
    }

    res.json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error) {
    next(error)
  }
})

//get document download URL
router.get('/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    //get document info
    const { data: document, error } = await supabaseAdmin
      .from('dokumenti')
      .select('file_path, original_filename, mime_type')
      .eq('id', id)
      .eq('created_by', userId)
      .single()

    if (error || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    //generate signed URL for download
    const { data: signedUrl, error: urlError } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(document.file_path, 3600) // 1 hour expiry

    if (urlError) {
      throw urlError
    }

    res.json({
      success: true,
      data: {
        downloadUrl: signedUrl.signedUrl,
        filename: document.original_filename,
        mimeType: document.mime_type,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      }
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
