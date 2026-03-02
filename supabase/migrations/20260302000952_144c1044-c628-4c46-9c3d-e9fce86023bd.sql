
-- ARCH-02: enforce_document_retention() DB function
-- ISO 19005 / ISO 22301 — Automatically marks expired archive_book entries for disposal

CREATE OR REPLACE FUNCTION public.enforce_document_retention()
RETURNS TABLE(
  archive_book_id uuid,
  entry_number integer,
  content_description text,
  retention_years integer,
  year_of_creation integer,
  expiry_year integer,
  action_taken text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_yr integer := extract(year from now())::integer;
BEGIN
  -- Return entries that have exceeded their retention period (excluding permanent)
  RETURN QUERY
  UPDATE archive_book ab
  SET notes = COALESCE(ab.notes, '') || E'\n[AUTO] Marked for disposal by enforce_document_retention() on ' || now()::date::text,
      updated_at = now()
  FROM (
    SELECT a.id, a.entry_number, a.content_description, a.retention_years, a.year_of_creation,
           (a.year_of_creation + COALESCE(a.retention_years, 0)) as calc_expiry
    FROM archive_book a
    WHERE a.retention_period != 'trajno'
      AND a.retention_years IS NOT NULL
      AND (a.year_of_creation + COALESCE(a.retention_years, 0)) <= current_yr
      AND a.transferred_to_archive = false
      AND a.notes NOT LIKE '%[AUTO] Marked for disposal%'
  ) expired
  WHERE ab.id = expired.id
  RETURNING ab.id, ab.entry_number, ab.content_description, ab.retention_years, ab.year_of_creation,
            expired.calc_expiry, 'marked_for_disposal'::text;
END;
$$;

-- Grant execute to authenticated users (tenant filtering happens via RLS on archive_book)
GRANT EXECUTE ON FUNCTION public.enforce_document_retention() TO authenticated;
