ALTER TABLE prompt_versions ADD COLUMN analysis_id uuid;
WITH latest_versions AS (
  SELECT DISTINCT ON (prompt_id) id, prompt_id
  FROM prompt_versions
  WHERE kind = 'IMPROVED'
  ORDER BY prompt_id, created_at DESC
), latest_analyses AS (
  SELECT DISTINCT ON (prompt_id) id, prompt_id
  FROM analyses
  WHERE status = 'COMPLETED'
  ORDER BY prompt_id, completed_at DESC NULLS LAST, created_at DESC
)
UPDATE prompt_versions AS version
SET analysis_id = analysis.id
FROM latest_versions, latest_analyses AS analysis
WHERE version.id = latest_versions.id
  AND latest_versions.prompt_id = analysis.prompt_id;
ALTER TABLE prompt_versions ADD CONSTRAINT prompt_versions_analysis_id_fkey
  FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX prompt_versions_analysis_id_key ON prompt_versions(analysis_id);
