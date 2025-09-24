// Test script for authentication endpoints
// Run with: node test-auth.js

const axios = require('axios')
const API_BASE = 'http://localhost:3001/api'

async function testAuth() {
  try {
    console.log('Testing Authentication Endpoints...\n')

    // Test 1: Health Check
    console.log('1. Testing health check...')
    const health = await axios.get('http://localhost:3001/health')
    console.log('Health:', health.data.status)
    console.log('Supabase:', health.data.services.supabase)

    // Test 2: Register User
    console.log('\n2. Testing user registration...')
    const registerData = {
      email: 'marko@example.com',
      password: 'ptkrf123#!',
      fullName: 'Marko'
    }

    try {
      const register = await axios.post(`${API_BASE}/auth/register`, registerData)
      console.log('Registration successful:', register.data.message)
      console.log('User ID:', register.data.user.id)
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('User already exists or validation failed')
        console.log('Details:', error.response.data.details || error.response.data.error)
      } else {
        throw error
      }
    }

    // Test 3: Login User (will only work if email is verified)
    console.log('\n3. Testing user login...')
    try {
      const login = await axios.post(`${API_BASE}/auth/login`, {
        email: registerData.email,
        password: registerData.password
      })
      console.log('Login successful!')
      console.log('Access token received:', login.data.session.access_token.substring(0, 20) + '...')
      
      // Test 4: Get Current User
      console.log('\n4. Testing get current user...')
      const me = await axios.get(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${login.data.session.access_token}`
        }
      })
      console.log('Current user:', me.data.user.email)
      console.log('Email verified:', me.data.user.emailVerified)

    } catch (error) {
      if (error.response?.status === 401) {
        console.log('Login failed - email likely not verified yet')
        console.log('Check your email and click the verification link')
      } else {
        throw error
      }
    }

    // Test 5: Password Reset
    console.log('\n5. Testing password reset...')
    try {
      const reset = await axios.post(`${API_BASE}/auth/forgot-password`, {
        email: registerData.email
      })
      console.log('Password reset email sent:', reset.data.message)
    } catch (error) {
      console.log(' Password reset failed:', error.response?.data?.error)
    }

  } catch (error) {
    console.error('Test failed:', error.message)
    if (error.response) {
      console.error('Response:', error.response.data)
    }
  }
}

// Pokretanje testova
testAuth()
