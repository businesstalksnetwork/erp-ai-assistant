#!/usr/bin/env node
/**
 * Run native_push_tokens migration using direct Postgres connection.
 * Requires: SUPABASE_DB_URL env var (from Supabase Dashboard → Settings → Database → Connection string URI)
 * Usage: SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.kskpmgohvrljbdphyzkw.supabase.co:5432/postgres" node scripts/run-migration-via-db-url.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, '../supabase/migrations/20260220120000_native_push_tokens.sql');
const sql = readFileSync(migrationPath, 'utf8');

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('Set SUPABASE_DB_URL (Database connection string from Supabase Dashboard)');
  process.exit(1);
}

try {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('Migration applied: native_push_tokens table created');
} catch (e) {
  if (e.message?.includes('relation "native_push_tokens" already exists')) {
    console.log('Table native_push_tokens already exists, skipping');
  } else {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
}
