const { supabase } = require('../config/supabase')
const { AuthenticationError } = require('./errorHandler')

/**
 * Authentication middleware to verify JWT tokens from Supabase
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Access token required')
    }

    const token = authHeader.substring(7) // Remove "Bearer " prefix

    // verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      throw new AuthenticationError('Invalid or expired token')
    }

    // check if user email is verified (optional, depending on requirements)
    if (!user.email_confirmed_at && process.env.REQUIRE_EMAIL_VERIFICATION === 'true') {
      throw new AuthenticationError('Email verification required')
    }

    // attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name,
      emailVerified: !!user.email_confirmed_at,
      role: user.user_metadata?.role || 'user',
      createdAt: user.created_at
    }

    // Attach the original token for potential use in subsequent requests
    req.token = token

    next()
  } catch (error) {
    // Set appropriate status code for authentication errors
    if (error instanceof AuthenticationError) {
      res.status(401)
    }
    next(error)
  }
}

/**
 * Optional middleware to check user roles
 * @param {string[]} allowedRoles - Array of roles that are allowed to access the route
 */
const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required')
      }

      const userRole = req.user.role || 'user'
      
      if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        const error = new Error('Insufficient permissions')
        error.name = 'AuthorizationError'
        res.status(403)
        return next(error)
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware to optionally authenticate user (doesn't fail if no token)
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      
      const { data: { user }, error } = await supabase.auth.getUser(token)

      if (!error && user) {
        req.user = {
          id: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name,
          emailVerified: !!user.email_confirmed_at,
          role: user.user_metadata?.role || 'user',
          createdAt: user.created_at
        }
        req.token = token
      }
    }

    // Continue regardless of authentication status
    next()
  } catch (error) {
    // Log the error but don't fail the request
    console.warn('Optional auth failed:', error.message)
    next()
  }
}

module.exports = {
  authMiddleware,
  requireRole,
  optionalAuth
}
