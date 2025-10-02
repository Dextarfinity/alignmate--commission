/**
 * Vercel Cron Job - Supabase Keep-Alive
 * 
 * This API route is designed to be called by Vercel Cron Jobs
 * to keep the Supabase database active.
 * 
 * Setup in Vercel:
 * 1. Add this file to your project
 * 2. Configure cron job in vercel.json
 * 3. Deploy to Vercel
 */

import { createClient } from '@supabase/supabase-js'

// Supabase configuration - using the same credentials as the main app
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ckkiaqgrlwoikjfgyaqy.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2lhcWdybHdvaWtqZmd5YXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5OTAzNDEsImV4cCI6MjA3MzU2NjM0MX0.72VPMQ52qxaRzjd6Jth2R3kGp4AcLnYu_WBcFs_a7j4'

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    })
  }

  try {
    console.log('🏥 Vercel Cron: Starting Supabase keep-alive...')
    
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
        return res.status(500).json({
          success: false,
          error: 'Both primary and fallback queries failed',
          timestamp: new Date().toISOString()
        })
      }
    }
    
    const timestamp = new Date().toISOString()
    console.log(`✅ Keep-alive successful at: ${timestamp}`)
    
    return res.status(200).json({
      success: true,
      message: 'Supabase database kept alive successfully',
      timestamp,
      query_result: data ? 'Data received' : 'No data',
      service: 'Vercel Cron Job'
    })
    
  } catch (error) {
    console.error('💥 Unexpected error:', error)
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      service: 'Vercel Cron Job'
    })
  }
}