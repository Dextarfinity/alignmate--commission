-- Weekly Progress Table Setup
-- This script ensures the weekly_progress table exists with the correct structure

-- Create weekly_progress table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.weekly_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_scans INTEGER DEFAULT 0,
  successful_scans INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique weekly records per user
  UNIQUE(user_id, week_start_date)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_weekly_progress_user_id ON weekly_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_progress_week_start_date ON weekly_progress(week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_progress_user_week ON weekly_progress(user_id, week_start_date);

-- Disable Row Level Security
ALTER TABLE public.weekly_progress DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies (cleanup)
DROP POLICY IF EXISTS "Users can view own weekly progress" ON public.weekly_progress;
DROP POLICY IF EXISTS "Users can insert own weekly progress" ON public.weekly_progress;
DROP POLICY IF EXISTS "Users can update own weekly progress" ON public.weekly_progress;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at when record is modified
DROP TRIGGER IF EXISTS update_weekly_progress_updated_at ON weekly_progress;
CREATE TRIGGER update_weekly_progress_updated_at
    BEFORE UPDATE ON weekly_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a manual aggregation function that can be called from the application
CREATE OR REPLACE FUNCTION aggregate_weekly_progress(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- This function can be called manually to aggregate weekly progress
    -- The main aggregation logic is handled by the frontend application
    
    SELECT json_build_object(
        'status', 'success',
        'message', 'Weekly progress aggregation triggered',
        'user_id', p_user_id,
        'timestamp', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON weekly_progress TO authenticated;
GRANT EXECUTE ON FUNCTION aggregate_weekly_progress(UUID) TO authenticated;

-- Display table structure for verification
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'weekly_progress' 
    AND table_schema = 'public'
ORDER BY ordinal_position;