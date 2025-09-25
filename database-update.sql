-- Database Update Script for New Settings Features
-- Run these SQL commands in your Supabase SQL Editor to add new settings columns

-- Add new columns to user_settings table
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_backup BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS privacy_mode BOOLEAN DEFAULT false;

-- Update the create_user_settings function to include new defaults
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (
    user_id, 
    notifications_enabled, 
    camera_auto_focus, 
    save_scan_history,
    dark_mode,
    sound_enabled,
    auto_backup,
    privacy_mode
  )
  VALUES (
    NEW.id, 
    true, 
    true, 
    true,
    false,
    true,
    true,
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing user_settings records to have default values for new columns
UPDATE user_settings 
SET 
  dark_mode = false,
  sound_enabled = true,
  auto_backup = true,
  privacy_mode = false
WHERE 
  dark_mode IS NULL 
  OR sound_enabled IS NULL 
  OR auto_backup IS NULL 
  OR privacy_mode IS NULL;