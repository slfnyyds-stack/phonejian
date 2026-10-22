import { sql } from "../db.ts";
import { chatJson, MODELS, markReceiptsCompleted } from "../providers/llm.ts";
import { modelFor } from "./models.ts";
import { promptText, promptVersion } from "./prompts.ts";
import {
  prepareSource,
  type ArticleInput,
} from "./interpretation-v2-core.ts";
import {
  runInterpretationPipeline,
  type PipelineRecord,
} from "./interpretation-v2-pipeline.ts";
import { REPO_ROOT } from "../config.ts";
import path from "node:path";
import { z } from "zod";

export { DraftSchema as InterpretationSchema } from "./interpretation-v2-core.ts";

export interface InterpretationView {
  reading: string;
  facts: string[];
  impact: string[];
  limits: string[];
  attribution: string;
  model: string;
}

export const INTERPRETATION_SYSTEM = promptText("interpretation-v2-write");
export const INTERPRETATION_PROMPT_VERSION = promptVersion(
  "interpretation-v2-write",
  "interpretation-v2-review",
  "interpretation-v2-repair",
);

interface ArticleRow {
  id: string;
  revision: number;
  title: string;
  url: string;
  author: string | null;
  published_at: Date | string | null;
  body_text: string;
  body_status: string | null;
  source_name: string;
}

interface ReceiptRow {
  response: {
    choices?: Array<{
      finish_reason?: string | null;
    }>;
  };
}

function normalizePublishedAt(
  publishedAt: Date | string | null,
): string | null {
  if (publishedAt === null) return null;
  if (publishedAt instanceof Date) return publishedAt.toISOString();
  const parsed = new Date(publishedAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function interpretArticle(
  articleId: string,
): Promise<PipelineRecord | null> {
  const articleRows = await sql<ArticleRow[]>`
    SELECT
      a.id,
      a.revision,
      a.title,
      a.url,
      a.author,
      a.published_at,
      a.body_text,
      a.body_status,
      s.name AS source_name
    FROM articles a
    JOIN sources s ON s.id = a.source_id
    WHERE a.id = ${articleId}
    LIMIT 1
  `;

  const article = articleRows[0];
  if (!article) return null;

  const model = await modelFor("interpretation");
  const actualModel = MODELS[model]?.model;
  if (actualModel !== "MiniMax-M3.1-Flash") {
    throw new Error("InterpretationModelMismatch");
  }

  const articleInput: ArticleInput = {
    id: article.id,
    revision: article.revision,
    title: article.title,
    url: article.url,
    author: article.author,
    published_at: normalizePublishedAt(article.published_at),
    body_text: article.body_text,
    body_status: article.body_status ?? "none",
    source_name: article.source_name,
  };
  const prepared = prepareSource(articleInput);

  const prompts = {
    write: promptText("interpretation-v2-write"),
    review: promptText("interpretation-v2-review"),
    repair: promptText("interpretation-v2-repair"),
  };
  const version = promptVersion(
    "interpretation-v2-write",
    "interpretation-v2-review",
    "interpretation-v2-repair",
  );

  return runInterpretationPipeline({
    sources: [prepared.source],
    modelName: actualModel,
    prompts,
    root: path.join(REPO_ROOT, "notes", "interpretation-v2-review"),
    callModel: async ({ stage, system, user, callId }) => {
      const result = await chatJson({
        model,
        purpose: `interpretation_v2_${stage}`,
        subject: `article:${articleId}:${callId}`,
        promptVersion: version,
        system,
        user,
        schema: z.unknown(),
        temperature: 0.2,
        maxTokens: 6500,
        timeoutMs: 180000,
        attemptTag: callId,
      });

      const receiptRows = await sql<ReceiptRow[]>`
        SELECT response
        FROM receipts
        WHERE id = ${result.receiptId}
        LIMIT 1
      `;
      const receipt = receiptRows[0];
      if (!receipt) throw new Error("ReceiptNotFound");

      const response = receipt.response;
      const finishReason = response?.choices?.[0]?.finish_reason;
      if (finishReason !== "stop") {
        throw new Error("IncompleteModelOutput");
      }

      await markReceiptsCompleted([result.receiptId]);
      return {
        value: result.data,
        receiptId: result.receiptId,
      };
    },
  });
}