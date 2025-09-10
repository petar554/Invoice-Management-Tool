const express = require('express')
const { body, validationResult } = require('express-validator')
const { supabase } = require('../config/supabase')
const { ValidationError, AuthenticationError } = require('../middleware/errorHandler')

const router = express.Router()

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

router.post('/register', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
], validateInput, async (req, res, next) => {
  try {
    const { email, password, fullName } = req.body

    //register user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    })

    if (error) {
      throw new AuthenticationError(error.message)
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification.',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        fullName: data.user?.user_metadata?.full_name
      }
    })
  } catch (error) {
    next(error)
  }
})

router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], validateInput, async (req, res, next) => {
  try {
    const { email, password } = req.body

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      throw new AuthenticationError('Invalid email or password')
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    })
  } catch (error) {
    next(error)
  }
})

router.post('/logout', async (req, res, next) => {
  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      throw new AuthenticationError(error.message)
    }

    res.json({
      success: true,
      message: 'Logout successful'
    })
  } catch (error) {
    next(error)
  }
})

//get current user
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Access token required')
    }

    const token = authHeader.substring(7)
    
    //get user from token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      throw new AuthenticationError('Invalid or expired token')
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name,
        emailVerified: user.email_confirmed_at ? true : false,
        createdAt: user.created_at
      }
    })
  } catch (error) {
    next(error)
  }
})

//refresh token
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
], validateInput, async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    })

    if (error) {
      throw new AuthenticationError('Invalid refresh token')
    }

    res.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    })
  } catch (error) {
    next(error)
  }
})

//password reset
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
], validateInput, async (req, res, next) => {
  try {
    const { email } = req.body

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    })

    if (error) {
      throw new AuthenticationError(error.message)
    }

    res.json({
      success: true,
      message: 'Password reset email sent'
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
