// Error handling middleware for the application

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`)
  res.status(404)
  next(error)
}

const errorHandler = (err, req, res, next) => {
  // Default to 500 server error
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode
  let message = err.message

  // Mongoose bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404
    message = 'Resource not found'
  }

  // Supabase errors
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        statusCode = 409
        message = 'Resource already exists'
        break
      case '23503': // Foreign key violation
        statusCode = 400
        message = 'Invalid reference'
        break
      case '23502': // Not null violation
        statusCode = 400
        message = 'Required field missing'
        break
      case 'PGRST116': // Table or view not found
        statusCode = 404
        message = 'Resource not found'
        break
      default:
        if (err.code.startsWith('23')) {
          statusCode = 400
          message = 'Database constraint violation'
        }
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401
    message = 'Invalid token'
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Token expired'
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413
    message = 'File too large'
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400
    message = 'Unexpected file field'
  }

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      name: err.name
    })
  }

  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        details: err 
      })
    },
    success: false,
    timestamp: new Date().toISOString()
  })
}

// Custom error classes
class ValidationError extends Error {
  constructor(message, field = null) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}

class AuthenticationError extends Error {
  constructor(message = 'Authentication failed') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

class AuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

class DocumentProcessingError extends Error {
  constructor(message, documentId = null, processingStep = null) {
    super(message)
    this.name = 'DocumentProcessingError'
    this.documentId = documentId
    this.processingStep = processingStep
  }
}

module.exports = {
  notFound,
  errorHandler,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  DocumentProcessingError
}
