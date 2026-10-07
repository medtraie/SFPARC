import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE URL or SERVICE ROLE KEY in env variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log("Applying DB changes via RPC execute_sql...");
  let { data, error } = await supabase.rpc('execute_sql', {
    sql: `
      ALTER TABLE public.vehicle_revisions 
      ADD COLUMN IF NOT EXISTS cost NUMERIC,
      ADD COLUMN IF NOT EXISTS current_km NUMERIC,
      ADD COLUMN IF NOT EXISTS reminder_km NUMERIC DEFAULT 200;
    `
  });
  console.log('RPC Result:', data, error);
}
run();