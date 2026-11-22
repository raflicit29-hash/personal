-- MR ALL Personal: read-only schema audit.
-- Safe to run in Supabase SQL Editor. This script does not modify data or schema.

-- 1) Actual columns and the four RPCs called by the website.
SELECT
  'COLUMN' AS item_type,
  c.table_name AS object_name,
  lpad(c.ordinal_position::text, 3, '0') AS sort_key,
  c.column_name || ' ' || c.data_type ||
    CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END AS details
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'personal_accounts',
    'personal_transactions',
    'personal_savings_goals',
    'personal_budgets',
    'personal_debts',
    'personal_savings_movements',
    'personal_debt_payments',
    'personal_bills',
    'personal_bill_payments'
  )

UNION ALL

SELECT
  'RPC' AS item_type,
  p.proname AS object_name,
  pg_get_function_identity_arguments(p.oid) AS sort_key,
  pg_get_function_result(p.oid) ||
    ' | security_definer=' || p.prosecdef::text AS details
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'record_personal_transaction',
    'record_personal_savings_movement',
    'record_personal_debt_payment',
    'record_personal_bill_payment'
  )
ORDER BY item_type, object_name, sort_key;

-- 2) RLS status and policies for all Personal tables.
SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  COALESCE(
    string_agg(
      p.policyname || ' [' || p.cmd || '] ' || COALESCE(p.qual, '') ||
      ' CHECK ' || COALESCE(p.with_check, ''),
      E'\n'
    ),
    '(no policies found)'
  ) AS policies
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.schemaname = t.schemaname
 AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename LIKE 'personal_%'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
