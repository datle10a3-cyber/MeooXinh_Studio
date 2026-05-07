-- Search helpers that do not require superuser-only PostgreSQL extensions.
CREATE OR REPLACE FUNCTION vi_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    lower(coalesce($1, '')),
    'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
  )
$$;

-- Index creation is intentionally skipped here because local PostgreSQL users may
-- not own restored tables. Search still uses vi_unaccent safely; table-owner
-- indexes can be added later in production with elevated DB privileges.
