// full Stack Integration Test
const axios = require('axios')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const FRONTEND_URL = 'http://localhost:3000'
const BACKEND_URL = 'http://localhost:3001'

console.log('🔗 Full Stack Integration Test\n')

// Node.js environment diagnostics
console.log('Environment Info:')
console.log('Node.js version:', process.version)
console.log('Platform:', process.platform)
console.log('OS:', require('os').type(), require('os').release())
console.log('Fetch support:', typeof fetch !== 'undefined' ? 'Native' : 'None')

async function testIntegration() {
  console.log('\n Network connection test...')
  try {
    const testResponse = await axios.get('https://httpbin.org/get', { timeout: 3000 })
    console.log('Internet connection working')
  } catch (netError) {
    console.log('Internet connection problem:', netError.message)
  }
  // Test 1: Frontend availability
  console.log('Testing Frontend server...')
  try {
    const response = await axios.get(FRONTEND_URL, { 
      timeout: 3000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
    if (response.status === 200) {
      console.log('Frontend available on http://localhost:3000')
    } else {
      console.log('Frontend not available:', response.status)
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('Frontend server not running on port 5173')
    } else if (error.code === 'TIMEOUT') {
      console.log('Frontend server timeout (maybe responding slowly)')
    } else {
      console.log('Frontend error:', error.message)
    }
  }

  // Test 2: Backend Health Check
  console.log('\n Testing Backend API...')
  try {
    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 3000 })
    if (response.status === 200) {
      console.log('Backend API available:', response.data)
    } else {
      console.log('Backend API problem:', response.status)
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('Backend server not running on port 3001')
    } else {
      console.log('Backend server error:', error.message)
    }
  }

  // Test 3: Backend API routes
  console.log('\n Testing API routes...')
  try {
    // Test documents endpoint (expects 401 Unauthorized without auth)
    const response = await axios.get(`${BACKEND_URL}/api/documents`, { 
      timeout: 3000,
      validateStatus: (status) => status < 500 // Accept 4xx responses
    })
    if (response.status === 401) {
      console.log('Documents API working (401 Unauthorized - expected)')
    } else if (response.status === 200) {
      console.log('Documents API returns 200 (unexpected, should be 401)')
    } else {
      console.log('Documents API unexpected status:', response.status)
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('Documents API working (401 Unauthorized - expected)')
    } else {
      console.log('Documents API error:', error.message)
    }
  }

  // Test 4: Supabase tables (from 001_initial_schema.sql)
  console.log('\n Supabase tables verification...')
  
  // Add network diagnostics
  console.log('Testing basic connection with Supabase...')
  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const response = await axios.get(`${supabaseUrl}/rest/v1/`, {
      timeout: 5000,
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      }
    })
    console.log('Direct HTTP connection with Supabase working')
  } catch (httpError) {
    console.log('Direct HTTP connection failed:', httpError.message)
    if (httpError.code === 'ENOTFOUND') {
      console.log('DNS problem - cannot resolve hostname')
    } else if (httpError.code === 'ECONNREFUSED') {
      console.log('Connection refused - firewall or server problem')
    } else if (httpError.code === 'CERT_HAS_EXPIRED' || httpError.message.includes('certificate')) {
      console.log('SSL/TLS certificate problem')
    }
  }
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL, 
      process.env.SUPABASE_ANON_KEY
    )

    // test documents table (from 001_initial_schema.sql)
    const { data: documentsData, error: documentsError } = await supabase
      .from('dokumenti')
      .select('count', { count: 'exact' })

    if (documentsError) {
      if (documentsError.message.includes('schema cache') || documentsError.message.includes('does not exist')) {
        console.log('Documents table does not exist - need to run 001_initial_schema.sql')
      } else {
        console.log('Documents table error:', documentsError.message)
      }
    } else {
      console.log('Documents table exists')
    }

    // Test auth.users table (Supabase built-in)
    const { data: usersData, error: usersError } = await supabase
      .from('auth.users')
      .select('count', { count: 'exact' })

    if (usersError) {
      // auth.users might not be directly accessible, that's normal
      console.log('Auth.users table - not accessible through public API (normal)')
    } else {
      console.log('Auth.users table accessible')
    }

    // test Storage bucket - Enhanced diagnostics
    console.log('\n🗂️ Storage bucket diagnostics...')
    
    // check Supabase configuration
    console.log('Supabase URL:', process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET')
    console.log('Anon Key:', process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'NOT SET')
    
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    console.log('Raw Response Data:', JSON.stringify(buckets, null, 2))
    console.log('Raw Response Error:', JSON.stringify(bucketsError, null, 2))
    
    if (bucketsError) {
      console.log('Storage buckets error:', bucketsError.message)
      console.log('Error code:', bucketsError.code)
      console.log('Error details:', bucketsError.details)
      console.log('Error hint:', bucketsError.hint)
      console.log('Check if you have permissions to access storage')
    } else if (!buckets || buckets.length === 0) {
      console.log('Storage API working BUT returns empty array of buckets')
      console.log('This means buckets are created but not visible through API')
      console.log('Possible causes:')
      console.log('1. RLS (Row Level Security) blocks access')
      console.log('2. Anon key does not have storage permissions') 
      console.log('3. Buckets are not fully created/activated')
      console.log('4. Region/project mismatch')
      
      // Try direct access to bucket that "doesn't exist"
      console.log('Testing direct access to "documents" bucket...')
      const { data: directAccess, error: directError } = await supabase.storage
        .from('documents')
        .list()
      
      if (directError) {
        console.log('Direct access FAILED:', directError.message)
        if (directError.message.includes('not found')) {
          console.log('Bucket really does not exist or is not activated')
        } else if (directError.message.includes('policy')) {
          console.log('RLS policy problem - bucket exists but no permissions')
        }
      } else {
        console.log('Direct access SUCCESSFUL! Bucket exists but does not appear in list')
        console.log('This is RLS problem - need storage policies')
      }
    } else {
      console.log('Storage buckets found:', buckets.length)
      console.log('Found buckets:', buckets.map(b => `"${b.name}"`).join(', '))
      
      const documentsBucket = buckets.find(b => b.name === 'documents')
      if (documentsBucket) {
        console.log('Documents storage bucket exists')
        console.log('Bucket info:', {
          name: documentsBucket.name,
          id: documentsBucket.id,
          public: documentsBucket.public,
          created_at: documentsBucket.created_at
        })
        
        // Test bucket access
        try {
          const { data: bucketFiles, error: bucketError } = await supabase.storage
            .from('documents')
            .list()
            
          if (bucketError) {
            console.log('No access to documents bucket:', bucketError.message)
            console.log('Maybe storage policies are not configured')
          } else {
            console.log('Access to documents bucket working')
            console.log('Number of files in bucket:', bucketFiles.length)
          }
        } catch (bucketTestError) {
          console.log('Bucket access test failed:', bucketTestError.message)
        }
      } else {
        console.log('Documents storage bucket does not exist in bucket list')
        console.log('Available buckets:', buckets.map(b => b.name))
        console.log('Check bucket name in Supabase Dashboard')
      }
    }

    // Test search_documents function
    console.log('\nTesting database functions...')
    try {
      const { data: searchData, error: searchError } = await supabase
        .rpc('search_documents', { search_query: 'test' })

      if (searchError) {
        if (searchError.message.includes('does not exist')) {
          console.log('search_documents function does not exist - need to run 001_initial_schema.sql')
        } else {
          console.log('search_documents error:', searchError.message)
        }
      } else {
        console.log('search_documents function exists and works')
      }
    } catch (funcError) {
      console.log('Function test error:', funcError.message)
    }

  } catch (error) {
    console.log('Supabase verification error:', error.message)
  }
}

testIntegration().catch(console.error)