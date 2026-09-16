-- supabase/migrations/20260831000006_enable_realtime_replication.sql
-- Enables Supabase Realtime CDC (Change Data Capture) replication for transactions, batches, and labels
-- in both Production (core) and Test Mode (sandbox) schemas.

DO $$
BEGIN
  -- Add core (production) tables to supabase_realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE core.transactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
            WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE core.batches;
  EXCEPTION WHEN duplicate_object THEN NULL;
            WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE core.labels;
  EXCEPTION WHEN duplicate_object THEN NULL;
            WHEN undefined_object THEN NULL;
  END;

  -- Add sandbox (test mode) tables to supabase_realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE sandbox.transactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
            WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE sandbox.batches;
  EXCEPTION WHEN duplicate_object THEN NULL;
            WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE sandbox.labels;
  EXCEPTION WHEN duplicate_object THEN NULL;
            WHEN undefined_object THEN NULL;
  END;
END $$;
