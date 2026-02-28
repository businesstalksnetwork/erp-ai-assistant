
-- 2.8: Block deletion of archive_book entries within retention period
CREATE OR REPLACE FUNCTION public.trg_block_retention_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.retention_years IS NOT NULL AND OLD.year_of_creation IS NOT NULL THEN
    IF (EXTRACT(YEAR FROM now()) - OLD.year_of_creation) < OLD.retention_years THEN
      RAISE EXCEPTION 'Cannot delete archive entry %. Retention period of % years has not expired (created %)',
        OLD.entry_number, OLD.retention_years, OLD.year_of_creation;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_block_retention_delete ON public.archive_book;
CREATE TRIGGER trg_block_retention_delete
  BEFORE DELETE ON public.archive_book
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_block_retention_delete();
