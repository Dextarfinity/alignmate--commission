import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ckkiaqgrlwoikjfgyaqy.supabase.co';
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2lhcWdybHdvaWtqZmd5YXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5OTAzNDEsImV4cCI6MjA3MzU2NjM0MX0.72VPMQ52qxaRzjd6Jth2R3kGp4AcLnYu_WBcFs_a7j4";

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
