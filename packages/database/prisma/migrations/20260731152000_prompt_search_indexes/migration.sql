CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "prompts_content_fts_idx"
  ON "prompts" USING GIN (to_tsvector('simple', "content"));

CREATE INDEX "prompts_content_trgm_idx"
  ON "prompts" USING GIN ("content" gin_trgm_ops);
