-- Up Migration
ALTER TABLE schemes ADD CONSTRAINT schemes_title_uniq UNIQUE (title);

-- Down Migration
ALTER TABLE schemes DROP CONSTRAINT IF EXISTS schemes_title_uniq;
