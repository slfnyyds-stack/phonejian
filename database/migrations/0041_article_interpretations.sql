-- 本表保存模型在通读原文后撰写的本站原创解读；它不是原文副本，也不是翻译。

CREATE TABLE IF NOT EXISTS article_interpretations (
  id bigserial PRIMARY KEY,
  article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  input_revision integer NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  receipt_id integer REFERENCES receipts(id),
  reading text NOT NULL,
  facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  impact jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '[]'::jsonb,
  attribution text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, input_revision)
);

CREATE INDEX IF NOT EXISTS article_interpretations_article_revision_idx
  ON article_interpretations (article_id, input_revision DESC);
