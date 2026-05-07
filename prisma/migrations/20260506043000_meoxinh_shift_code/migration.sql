WITH ordered AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY "studioId" ORDER BY "openedAt" ASC, id ASC) AS seq
  FROM "WalletShift"
)
UPDATE "WalletShift" ws
SET "code" = 'CA-MEOXINH-' || lpad(ordered.seq::text, 3, '0')
FROM ordered
WHERE ws.id = ordered.id;
