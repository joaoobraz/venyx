ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS watermark_position TEXT NOT NULL DEFAULT 'bottom-right',
  ADD COLUMN IF NOT EXISTS watermark_opacity NUMERIC NOT NULL DEFAULT 0.6;

-- Validation trigger (avoid CHECK constraints per platform guidance)
CREATE OR REPLACE FUNCTION public.validate_watermark_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.watermark_position NOT IN ('top-left','top-right','bottom-left','bottom-right','center') THEN
    RAISE EXCEPTION 'invalid watermark_position: %', NEW.watermark_position;
  END IF;
  IF NEW.watermark_opacity < 0.1 OR NEW.watermark_opacity > 1 THEN
    RAISE EXCEPTION 'watermark_opacity must be between 0.1 and 1';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_watermark_settings_trg ON public.profiles;
CREATE TRIGGER validate_watermark_settings_trg
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_watermark_settings();
