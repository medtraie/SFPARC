-- =========================================================
-- Facturation RLS Quick A/B Test (2-3 min)
-- الهدف:
-- 1) User A يشوف فقط بياناته
-- 2) User B يشوف فقط بياناته
-- 3) New user يشوف التطبيق فارغ
--
-- الاستخدام:
-- - نفّذ هذا السكربت في Supabase SQL Editor بعد تطبيق migration:
--   20260415113000_facturation_strict_rls.sql
-- - غيّر UUIDs في القسم التالي بقيم حقيقية من auth.users
-- =========================================================

-- ====== إعداد المستخدمين (غيّر هذه القيم) ======
DO $$
BEGIN
  IF '11111111-1111-1111-1111-111111111111'::uuid = '22222222-2222-2222-2222-222222222222'::uuid THEN
    RAISE EXCEPTION 'User A and User B must be different';
  END IF;
END $$;

-- ملاحظة:
-- Supabase RLS يعتمد claim: request.jwt.claim.sub + role=authenticated
-- هذا السكربت يحاكي مستخدمين مختلفين داخل SQL session واحدة.

BEGIN;

-- ---------------------------------------------------------
-- Cleanup قديم (اختياري وآمن لنطاق test docs)
-- ---------------------------------------------------------
RESET ROLE;
DELETE FROM public.fact_documents
WHERE doc_number LIKE 'RLS-A-%'
   OR doc_number LIKE 'RLS-B-%';

-- ---------------------------------------------------------
-- 1) إنشاء بيانات User A تحت سياق authenticated + sub=A
-- ---------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

INSERT INTO public.fact_documents (
  doc_type,
  doc_number,
  status,
  issue_date,
  client_name,
  created_by,
  user_id
)
VALUES (
  'facture',
  'RLS-A-' || to_char(now(), 'HH24MISSMS'),
  'draft',
  CURRENT_DATE,
  'Client A',
  auth.uid(),
  auth.uid()
);

-- ---------------------------------------------------------
-- 2) إنشاء بيانات User B تحت سياق authenticated + sub=B
-- ---------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

INSERT INTO public.fact_documents (
  doc_type,
  doc_number,
  status,
  issue_date,
  client_name,
  created_by,
  user_id
)
VALUES (
  'facture',
  'RLS-B-' || to_char(now(), 'HH24MISSMS'),
  'draft',
  CURRENT_DATE,
  'Client B',
  auth.uid(),
  auth.uid()
);

-- ---------------------------------------------------------
-- 3) Assertions: User A يرى فقط A
-- ---------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

DO $$
DECLARE
  own_count int;
  other_count int;
BEGIN
  SELECT count(*) INTO own_count
  FROM public.fact_documents
  WHERE doc_number LIKE 'RLS-A-%';

  SELECT count(*) INTO other_count
  FROM public.fact_documents
  WHERE doc_number LIKE 'RLS-B-%';

  IF own_count < 1 THEN
    RAISE EXCEPTION 'FAIL: User A cannot see own data';
  END IF;

  IF other_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: User A can see User B data';
  END IF;
END $$;

-- ---------------------------------------------------------
-- 4) Assertions: User B يرى فقط B
-- ---------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

DO $$
DECLARE
  own_count int;
  other_count int;
BEGIN
  SELECT count(*) INTO own_count
  FROM public.fact_documents
  WHERE doc_number LIKE 'RLS-B-%';

  SELECT count(*) INTO other_count
  FROM public.fact_documents
  WHERE doc_number LIKE 'RLS-A-%';

  IF own_count < 1 THEN
    RAISE EXCEPTION 'FAIL: User B cannot see own data';
  END IF;

  IF other_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: User B can see User A data';
  END IF;
END $$;

-- ---------------------------------------------------------
-- 5) Assertions: New user يرى بيانات فارغة
-- ---------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

DO $$
DECLARE
  c int;
BEGIN
  SELECT count(*) INTO c
  FROM public.fact_documents
  WHERE doc_number LIKE 'RLS-A-%'
     OR doc_number LIKE 'RLS-B-%';

  IF c <> 0 THEN
    RAISE EXCEPTION 'FAIL: New user can see existing users data';
  END IF;
END $$;

-- ---------------------------------------------------------
-- 6) نتيجة نهائية
-- ---------------------------------------------------------
SELECT 'PASS: Facturation RLS isolation is working (A/B/New user).' AS result;

COMMIT;

-- ---------------------------------------------------------
-- اختياري: تنظيف بيانات الاختبار بعد النجاح
-- ---------------------------------------------------------
-- RESET ROLE;
-- DELETE FROM public.fact_documents
-- WHERE doc_number LIKE 'RLS-A-%'
--    OR doc_number LIKE 'RLS-B-%';

