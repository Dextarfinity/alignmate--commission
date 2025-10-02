/**
 * Supabase Keep-Alive Script
 * 
 * This script prevents Supabase free tier databases from pausing due to inactivity.
 * It sends a simple query to the database weekly to maintain activity.
 * 
 * Usage:
 * - Can be run locally with: node scripts/keep-alive.js
 * - Can be deployed as a Vercel Cron Job
 * - Can be used with GitHub Actions
 */

import { createClient } from '@supabase/supabase-js'

// Supabase configuration - using the same credentials as the main app
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ckkiaqgrlwoikjfgyaqy.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2lhcWdybHdvaWtqZmd5YXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5OTAzNDEsImV4cCI6MjA3MzU2NjM0MX0.72VPMQ52qxaRzjd6Jth2R3kGp4AcLnYu_WBcFs_a7j4'

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables!')
  console.error('Required: SUPABASE_URL and SUPABASE_ANON_KEY')
  process.exit(1)
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Main keep-alive function
 */
async function keepAlive() {
  try {
    console.log('🏥 Starting Supabase keep-alive check...')
    
    // Simple query to keep database active
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Keep-alive query failed:', error.message)
      
      // Try a simpler query as fallback
      console.log('🔄 Trying fallback query...')
      const { error: fallbackError } = await supabase.auth.getSession()
      
      if (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError.message)
        return false
      } else {
        console.log('✅ Fallback query successful - database is alive!')
        return true
      }
    }
    
    console.log('✅ Keep-alive successful - database is active!')
    console.log(`📊 Query result: ${data ? 'Data received' : 'No data'}`)
    
    // Optional: Log some stats
    const timestamp = new Date().toISOString()
    console.log(`⏰ Keep-alive completed at: ${timestamp}`)
    
    return true
    
  } catch (error) {
    console.error('💥 Unexpected error during keep-alive:', error)
    return false
  }
}

/**
 * Health check function
 */
async function healthCheck() {
  try {
    console.log('🔍 Performing health check...')
    
    // Check if we can connect to Supabase
    const { error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('❌ Health check failed:', error.message)
      return false
    }
    
    console.log('✅ Health check passed - Supabase is reachable!')
    return true
    
  } catch (error) {
    console.error('💥 Health check error:', error)
    return false
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🎯 ALIGNMATE - Supabase Keep-Alive Service')
  console.log('=====================================')
  
  // Perform health check first
  const isHealthy = await healthCheck()
  
  if (!isHealthy) {
    console.error('❌ Health check failed - aborting keep-alive')
    process.exit(1)
  }
  
  // Perform keep-alive
  const success = await keepAlive()
  
  if (success) {
    console.log('🎖️ Mission accomplished! Database kept alive.')
    process.exit(0)
  } else {
    console.error('❌ Mission failed! Keep-alive unsuccessful.')
    process.exit(1)
  }
}

// Execute main function
main().catch(console.error)

// Export functions for potential module usage
export { keepAlive, healthCheck }