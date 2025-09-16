-- AlignMate Database Schema
-- Run these SQL commands in your Supabase SQL Editor

-- Enable Row Level Security
-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  rank TEXT,
  unit TEXT,
  profile_image_url TEXT,
  join_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scan_history table
CREATE TABLE IF NOT EXISTS scan_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  posture_type TEXT NOT NULL CHECK (posture_type IN ('salutation', 'marching', 'attention')),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  success BOOLEAN NOT NULL,
  feedback TEXT,
  scan_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  notifications_enabled BOOLEAN DEFAULT true,
  camera_auto_focus BOOLEAN DEFAULT true,
  save_scan_history BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create weekly_progress table for analytics
CREATE TABLE IF NOT EXISTS weekly_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_scans INTEGER DEFAULT 0,
  successful_scans INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Scan history policies
CREATE POLICY "Users can view own scan history" ON scan_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scan history" ON scan_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scan history" ON scan_history
  FOR UPDATE USING (auth.uid() = user_id);

-- User settings policies
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Weekly progress policies
CREATE POLICY "Users can view own weekly progress" ON weekly_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly progress" ON weekly_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly progress" ON weekly_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Create functions for automatic weekly progress calculation
CREATE OR REPLACE FUNCTION update_weekly_progress()
RETURNS TRIGGER AS $$
DECLARE
  week_start DATE;
  week_end DATE;
  user_avg_score DECIMAL(5,2);
  user_total_scans INTEGER;
  user_successful_scans INTEGER;
BEGIN
  -- Calculate week start (Monday) and end (Sunday)
  week_start := DATE_TRUNC('week', NEW.scan_date)::DATE;
  week_end := (week_start + INTERVAL '6 days')::DATE;
  
  -- Calculate user's stats for this week
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE success = true),
    COALESCE(AVG(score), 0)
  INTO user_total_scans, user_successful_scans, user_avg_score
  FROM scan_history 
  WHERE user_id = NEW.user_id 
    AND scan_date >= week_start 
    AND scan_date <= week_end + INTERVAL '1 day';

  -- Insert or update weekly progress
  INSERT INTO weekly_progress (user_id, week_start_date, week_end_date, total_scans, successful_scans, average_score)
  VALUES (NEW.user_id, week_start, week_end, user_total_scans, user_successful_scans, user_avg_score)
  ON CONFLICT (user_id, week_start_date) 
  DO UPDATE SET 
    total_scans = user_total_scans,
    successful_scans = user_successful_scans,
    average_score = user_avg_score,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic weekly progress update
CREATE TRIGGER update_weekly_progress_trigger
  AFTER INSERT ON scan_history
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_progress();

-- Create function to automatically create user settings on profile creation
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic user settings creation
CREATE TRIGGER create_user_settings_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_settings();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_date ON scan_history(scan_date);
CREATE INDEX IF NOT EXISTS idx_weekly_progress_user_id ON weekly_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_progress_week_start ON weekly_progress(week_start_date);

-- Insert some sample data for testing (optional)
-- You can remove this section if you don't want sample data

-- Note: To run this file:
-- 1. Go to your Supabase dashboard
-- 2. Navigate to SQL Editor
-- 3. Create a new query
-- 4. Copy and paste this entire file
-- 5. Run the query