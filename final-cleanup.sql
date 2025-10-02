-- COMPREHENSIVE CLEANUP - Remove ALL conflicting database elements
-- Run this in Supabase SQL Editor to clean everything up

-- 1. DISABLE ROW LEVEL SECURITY on all tables
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS weekly_progress DISABLE ROW LEVEL SECURITY;

-- 2. DROP ALL RLS POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON profiles;

DROP POLICY IF EXISTS "Users can view own scan history" ON scan_history;
DROP POLICY IF EXISTS "Users can insert own scan history" ON scan_history;
DROP POLICY IF EXISTS "Users can update own scan history" ON scan_history;

DROP POLICY IF EXISTS "Users can view own weekly progress" ON weekly_progress;
DROP POLICY IF EXISTS "Users can insert own weekly progress" ON weekly_progress;
DROP POLICY IF EXISTS "Users can update own weekly progress" ON weekly_progress;

-- 3. DROP ALL TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users CASCADE;
DROP TRIGGER IF EXISTS create_profile_trigger ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_new_user_created ON auth.users CASCADE;

DROP TRIGGER IF EXISTS profiles_trigger ON profiles CASCADE;
DROP TRIGGER IF EXISTS handle_updated_at ON profiles CASCADE;
DROP TRIGGER IF EXISTS on_profile_created ON profiles CASCADE;

DROP TRIGGER IF EXISTS update_weekly_progress_trigger ON scan_history CASCADE;
DROP TRIGGER IF EXISTS create_user_settings_trigger ON profiles CASCADE;

-- 4. DROP ALL FUNCTIONS
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_profile_for_user() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS create_profile_for_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS create_user_settings() CASCADE;
DROP FUNCTION IF EXISTS update_weekly_progress() CASCADE;

-- 5. DROP USER_SETTINGS TABLE COMPLETELY
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;

-- 6. UPDATE PROFILES TABLE SCHEMA (match your image)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS id_number VARCHAR(255),
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '/assets/avatar1.png';

-- Drop old columns that don't exist in your schema
ALTER TABLE profiles DROP COLUMN IF EXISTS rank CASCADE;
ALTER TABLE profiles DROP COLUMN IF EXISTS unit CASCADE;
ALTER TABLE profiles DROP COLUMN IF EXISTS profile_image_url CASCADE;
ALTER TABLE profiles DROP COLUMN IF EXISTS join_date CASCADE;

-- 6.1. UPDATE WEEKLY_PROGRESS TABLE SCHEMA (ensure correct columns)
ALTER TABLE weekly_progress 
ADD COLUMN IF NOT EXISTS week_start_date DATE,
ADD COLUMN IF NOT EXISTS week_end_date DATE,
ADD COLUMN IF NOT EXISTS total_scans INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS successful_scans INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_score DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Drop old columns that might conflict
ALTER TABLE weekly_progress DROP COLUMN IF EXISTS week_start CASCADE;

-- 7. CREATE ONLY THE ESSENTIAL FUNCTIONS (NO TRIGGERS)
CREATE OR REPLACE FUNCTION save_scan_result(
  p_user_id UUID,
  p_posture_type TEXT,
  p_score INTEGER,
  p_success BOOLEAN,
  p_feedback TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  scan_id UUID;
BEGIN
  INSERT INTO scan_history (user_id, posture_type, score, success, feedback)
  VALUES (p_user_id, p_posture_type, p_score, p_success, p_feedback)
  RETURNING id INTO scan_id;
  
  RETURN scan_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_scans BIGINT,
  avg_score NUMERIC,
  best_score INTEGER,
  streak_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_scans,
    COALESCE(AVG(score), 0) as avg_score,
    COALESCE(MAX(score), 0) as best_score,
    7 as streak_days -- Simplified for now
  FROM scan_history 
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_recent_scans(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  posture_type TEXT,
  score INTEGER,
  success BOOLEAN,
  scan_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sh.id,
    sh.posture_type,
    sh.score,
    sh.success,
    sh.scan_date
  FROM scan_history sh
  WHERE sh.user_id = p_user_id
  ORDER BY sh.scan_date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 8. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_id_number ON profiles(id_number);
CREATE INDEX IF NOT EXISTS idx_profiles_age ON profiles(age);
CREATE INDEX IF NOT EXISTS idx_scan_history_posture_type ON scan_history(posture_type);
CREATE INDEX IF NOT EXISTS idx_scan_history_success ON scan_history(success);
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history(created_at);
CREATE INDEX IF NOT EXISTS idx_weekly_progress_user_id ON weekly_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_progress_week_start_date ON weekly_progress(week_start_date);

-- 9. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION save_scan_result TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_scans TO authenticated;

-- 10. VERIFY CLEANUP (check what's left)
SELECT 'TRIGGERS' as type, trigger_name as name, event_object_table as table_name
FROM information_schema.triggers 
WHERE event_object_table IN ('profiles', 'users', 'scan_history', 'weekly_progress')
AND trigger_name NOT LIKE 'RI_ConstraintTrigger%'

UNION ALL

SELECT 'FUNCTIONS' as type, routine_name as name, '' as table_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%user%'

UNION ALL

SELECT 'TABLES' as type, table_name as name, '' as table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%user_settings%';