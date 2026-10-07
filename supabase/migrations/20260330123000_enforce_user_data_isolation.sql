DO $$
DECLARE
  t record;
  p record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('spatial_ref_sys')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS user_id uuid', t.tablename);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET DEFAULT auth.uid()', t.tablename);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);

    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t.tablename
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t.tablename);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY p_user_select ON public.%I FOR SELECT USING (auth.role() = ''service_role'' OR auth.uid() = user_id)',
      t.tablename
    );
    EXECUTE format(
      'CREATE POLICY p_user_insert ON public.%I FOR INSERT WITH CHECK (auth.role() = ''service_role'' OR auth.uid() = user_id)',
      t.tablename
    );
    EXECUTE format(
      'CREATE POLICY p_user_update ON public.%I FOR UPDATE USING (auth.role() = ''service_role'' OR auth.uid() = user_id) WITH CHECK (auth.role() = ''service_role'' OR auth.uid() = user_id)',
      t.tablename
    );
    EXECUTE format(
      'CREATE POLICY p_user_delete ON public.%I FOR DELETE USING (auth.role() = ''service_role'' OR auth.uid() = user_id)',
      t.tablename
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id)',
      'idx_' || t.tablename || '_user_id',
      t.tablename
    );
  END LOOP;
END
$$;

ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;
DROP INDEX IF EXISTS public.app_settings_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_key_user_id_key
  ON public.app_settings (key, user_id);
