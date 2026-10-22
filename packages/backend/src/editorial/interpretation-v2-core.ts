import { z } from "zod";
import { createHash } from "node:crypto";

/**
 * interpretation-v2-core
 *
 * 稿件候选（candidate）与审核结论（review）的纯函数核心：
 * 结构约束（zod）+ 闸门校验（validate*）+ 来源正文清洗（prepareSource）。
 *
 * 依赖仅限 zod 与 node:crypto：无数据库、无环境变量、无凭据、无网络、无模型调用。
 * 全部使用可擦除 TypeScript 语法（无 enum / namespace / 参数属性），Node 26 可直接运行。
 */

/* --------------------------------------------------------------------------
 * 0. 闸门通用类型
 * ----------------------------------------------------------------------- */

export interface GateIssue {
  /** 稳定的机器可读代码，例如 duplicate_evidence_id / incomplete_analysis */
  code: string;
  /** 出错位置，例如 candidate.evidence[0].quotes[1].text */
  location: string;
  /** 人类可读说明 */
  message: string;
}

export interface GateResult {
  ok: boolean;
  issues: GateIssue[];
}

/* --------------------------------------------------------------------------
 * 1. Draft（稿件正文）
 * ----------------------------------------------------------------------- */

export interface Draft {
  reading: string;
  facts: string[];
  impact: string[];
  limits: string[];
  attribution: string;
}

// zod 4：z.object(...).catchall(z.never()) 即 strict，未知键直接判错。
export const DraftSchema = z
  .object({
    reading: z.string().min(1).max(4000),
    facts: z.array(z.string().max(400)),
    impact: z.array(z.string().max(400)),
    limits: z.array(z.string().max(400)),
    attribution: z.string().min(1).max(800),
  })
  .catchall(z.never());

/* --------------------------------------------------------------------------
 * 2. Candidate（候选稿）
 * ----------------------------------------------------------------------- */

export type Decision = "skip" | "hold" | "brief" | "analysis";
export type EvidenceKind = "source_fact" | "inference" | "calculation";

export interface EvidenceQuote {
  source_id: string;
  text: string;
}

export interface Evidence {
  id: string;
  claim: string;
  kind: EvidenceKind;
  source_ids: string[];
  quotes: EvidenceQuote[];
  derivation: string;
}

export interface Candidate {
  decision: Decision;
  reason: string;
  focus: string;
  title: string;
  draft: Draft | null;
  evidence: Evidence[];
  open_questions: string[];
  publish_ready: false;
}

export const EvidenceQuoteSchema = z
  .object({
    source_id: z.string(),
    text: z.string(),
  })
  .catchall(z.never());

export const EvidenceSchema = z
  .object({
    id: z.string().min(1),
    claim: z.string(),
    kind: z.enum(["source_fact", "inference", "calculation"]),
    source_ids: z.array(z.string()),
    quotes: z.array(EvidenceQuoteSchema),
    derivation: z.string(),
  })
  .catchall(z.never());

export const CandidateSchema = z
  .object({
    decision: z.enum(["skip", "hold", "brief", "analysis"]),
    reason: z.string(),
    focus: z.string(),
    title: z.string(),
    draft: z.union([DraftSchema, z.null()]),
    evidence: z.array(EvidenceSchema),
    open_questions: z.array(z.string()),
    publish_ready: z.literal(false),
  })
  .catchall(z.never());

/* --------------------------------------------------------------------------
 * 3. Source（来源正文）
 * ----------------------------------------------------------------------- */

export interface Source {
  source_id: string;
  url: string;
  title: string;
  source_name: string;
  author: string | null;
  published_at: string | null;
  revision: number;
  clean_text: string;
  coverage: string;
}

export const SourceSchema = z
  .object({
    source_id: z.string(),
    url: z.string(),
    title: z.string(),
    source_name: z.string(),
    author: z.string().nullable(),
    published_at: z.string().nullable(),
    revision: z.number(),
    clean_text: z.string(),
    coverage: z.string(),
  })
  .catchall(z.never());

/* --------------------------------------------------------------------------
 * 4. Review（审核结论）
 * ----------------------------------------------------------------------- */

export type ReviewVerdict = "pass" | "revise" | "hold" | "skip";
export type CheckResult = "pass" | "fail" | "not_applicable" | "uncertain";
export type CheckName =
  | "coverage"
  | "time_reference"
  | "time_scope"
  | "sales_stage"
  | "technical_direction"
  | "source_attribution"
  | "evidence"
  | "editorial_quality";
export type IssueSeverity = "blocker" | "major" | "minor";

export interface ReviewIssue {
  severity: IssueSeverity;
  location: string;
  claim: string;
  source_ids: string[];
  source_quote: string;
  problem: string;
  required_change: string;
}

export interface ReviewChecks {
  coverage: CheckResult;
  time_reference: CheckResult;
  time_scope: CheckResult;
  sales_stage: CheckResult;
  technical_direction: CheckResult;
  source_attribution: CheckResult;
  evidence: CheckResult;
  editorial_quality: CheckResult;
}

export interface Review {
  verdict: ReviewVerdict;
  checks: ReviewChecks;
  issues: ReviewIssue[];
  publish_ready: false;
}

const checkResultSchema = z.enum(["pass", "fail", "not_applicable", "uncertain"]);

export const ReviewSchema = z
  .object({
    verdict: z.enum(["pass", "revise", "hold", "skip"]),
    checks: z
      .object({
        coverage: checkResultSchema,
        time_reference: checkResultSchema,
        time_scope: checkResultSchema,
        sales_stage: checkResultSchema,
        technical_direction: checkResultSchema,
        source_attribution: checkResultSchema,
        evidence: checkResultSchema,
        editorial_quality: checkResultSchema,
      })
      .catchall(z.never()),
    issues: z.array(
      z
        .object({
          severity: z.enum(["blocker", "major", "minor"]),
          location: z.string(),
          claim: z.string(),
          source_ids: z.array(z.string()),
          source_quote: z.string(),
          problem: z.string(),
          required_change: z.string(),
        })
        .catchall(z.never()),
    ),
    publish_ready: z.literal(false),
  })
  .catchall(z.never());

/* --------------------------------------------------------------------------
 * 5. 内部工具
 * ----------------------------------------------------------------------- */

const locationOf = (root: string, path: readonly PropertyKey[]): string =>
  [root, ...path.map((segment) => String(segment))].join(".");

const isBlank = (value: string | null | undefined): boolean =>
  typeof value !== "string" || value.trim().length === 0;

const nullableText = (value: string | null | undefined): string | null =>
  value === undefined || value === null ? null : value;

/* --------------------------------------------------------------------------
 * 6. validateCandidate —— 候选稿闸门
 *
 * 规则：
 * - 结构不合规直接判错，不做任何修复；
 * - 证据 id 唯一；source_ids 非空且全部来自输入 sources；
 * - 每条引文的 source_id 必须属于所属证据，且引文需在来源正文中连续逐字存在；
 * - source_fact 至少一条引文；inference 必须有推导过程与前提引文；
 * - calculation 一律转人工复核，校验器绝不执行任何计算；
 * - skip/hold 必须没有稿件；brief/analysis 必须有稿件与非空 title/focus/evidence；
 * - analysis 正文不足 160 字符或不足两自然段判为 incomplete_analysis；
 * - 有稿件但来源正文为空时拒绝。
 * ----------------------------------------------------------------------- */

export function validateCandidate(value: unknown, sources: Source[]): GateResult {
  const issues: GateIssue[] = [];

  const parsed = CandidateSchema.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        code: "invalid_candidate",
        location: locationOf("candidate", issue.path),
        message: issue.message,
      });
    }
    return { ok: false, issues };
  }

  const candidate = parsed.data;
  const sourceList: Source[] = sources ?? [];
  const sourceById = new Map<string, Source>();
  for (const source of sourceList) {
    if (!sourceById.has(source.source_id)) {
      sourceById.set(source.source_id, source);
    }
  }

  const seenEvidenceIds = new Set<string>();

  candidate.evidence.forEach((evidence, evidenceIndex) => {
    const base = `candidate.evidence[${evidenceIndex}]`;

    if (seenEvidenceIds.has(evidence.id)) {
      issues.push({
        code: "duplicate_evidence_id",
        location: `${base}.id`,
        message: `证据 id 重复：${evidence.id}`,
      });
    } else {
      seenEvidenceIds.add(evidence.id);
    }

    if (evidence.source_ids.length === 0) {
      issues.push({
        code: "empty_source_ids",
        location: `${base}.source_ids`,
        message: "证据必须至少引用一个来源",
      });
    }

    const uniqueSourceIds = new Set(evidence.source_ids);
    if (uniqueSourceIds.size !== evidence.source_ids.length) {
      issues.push({
        code: "duplicate_source_id",
        location: `${base}.source_ids`,
        message: "证据 source_ids 中存在重复项",
      });
    }

    evidence.source_ids.forEach((sourceId, sourceIndex) => {
      const source = sourceById.get(sourceId);
      if (!source) {
        issues.push({
          code: "unknown_source_id",
          location: `${base}.source_ids[${sourceIndex}]`,
          message: `来源 ${sourceId} 不在输入的 sources 中`,
        });
        return;
      }
      if (isBlank(source.clean_text)) {
        issues.push({
          code: "empty_source_text",
          location: `${base}.source_ids[${sourceIndex}]`,
          message: `来源 ${sourceId} 正文为空，不能作为证据来源`,
        });
      }
    });

    evidence.quotes.forEach((quote, quoteIndex) => {
      const quoteBase = `${base}.quotes[${quoteIndex}]`;
      if (!evidence.source_ids.includes(quote.source_id)) {
        issues.push({
          code: "quote_source_mismatch",
          location: `${quoteBase}.source_id`,
          message: `引文来源 ${quote.source_id} 不属于该证据的 source_ids`,
        });
      }
      const source = sourceById.get(quote.source_id);
      if (!source) {
        issues.push({
          code: "unknown_source_id",
          location: `${quoteBase}.source_id`,
          message: `引文来源 ${quote.source_id} 不在输入的 sources 中`,
        });
        return;
      }
      if (isBlank(quote.text)) {
        issues.push({
          code: "empty_quote",
          location: `${quoteBase}.text`,
          message: "引文不能为空",
        });
        return;
      }
      if (!source.clean_text.includes(quote.text)) {
        issues.push({
          code: "quote_not_found",
          location: `${quoteBase}.text`,
          message: `引文未在来源 ${quote.source_id} 正文中连续逐字出现`,
        });
      }
    });

    if (evidence.kind === "source_fact" && evidence.quotes.length === 0) {
      issues.push({
        code: "missing_quote",
        location: `${base}.quotes`,
        message: "source_fact 证据必须至少包含一条引文",
      });
    }

    if (evidence.kind === "inference") {
      if (isBlank(evidence.derivation)) {
        issues.push({
          code: "missing_derivation",
          location: `${base}.derivation`,
          message: "inference 证据必须给出非空推导过程",
        });
      }
      if (evidence.quotes.length === 0) {
        issues.push({
          code: "missing_premise_quote",
          location: `${base}.quotes`,
          message: "inference 证据必须给出至少一条前提引文",
        });
      }
    }

    if (evidence.kind === "calculation") {
      issues.push({
        code: "calculation_requires_human_check",
        location: `${base}.kind`,
        message: "计算类证据必须由人工复核，校验器不会执行也不会推断任何计算结果",
      });
    }
  });

  if (candidate.decision === "skip" || candidate.decision === "hold") {
    if (candidate.draft !== null) {
      issues.push({
        code: "draft_not_allowed",
        location: "candidate.draft",
        message: `${candidate.decision} 决策不允许携带稿件，draft 必须为 null`,
      });
    }
  } else {
    if (candidate.draft === null) {
      issues.push({
        code: "missing_draft",
        location: "candidate.draft",
        message: `${candidate.decision} 决策必须提供稿件`,
      });
    }
    if (isBlank(candidate.title)) {
      issues.push({
        code: "missing_title",
        location: "candidate.title",
        message: `${candidate.decision} 决策必须提供非空标题`,
      });
    }
    if (isBlank(candidate.focus)) {
      issues.push({
        code: "missing_focus",
        location: "candidate.focus",
        message: `${candidate.decision} 决策必须提供非空聚焦说明`,
      });
    }
    if (candidate.evidence.length === 0) {
      issues.push({
        code: "missing_evidence",
        location: "candidate.evidence",
        message: `${candidate.decision} 决策必须提供至少一条证据`,
      });
    }
  }

  if (candidate.decision === "analysis" && candidate.draft !== null) {
    const reading = candidate.draft.reading.trim();
    const paragraphs = reading
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0);
    const paragraphCount =
      paragraphs.length >= 2
        ? paragraphs.length
        : reading
            .split(/\n/)
            .map((paragraph) => paragraph.trim())
            .filter((paragraph) => paragraph.length > 0).length;
    if (reading.length < 160 || paragraphCount < 2) {
      issues.push({
        code: "incomplete_analysis",
        location: "candidate.draft.reading",
        message: `analysis 正文不足：${reading.length} 字符、${paragraphCount} 段（要求至少 160 字符且至少 2 个自然段）`,
      });
    }
  }

  if (candidate.draft !== null) {
    const hasWritableSource = sourceList.some((source) => !isBlank(source.clean_text));
    if (!hasWritableSource) {
      issues.push({
        code: "empty_source_text",
        location: "candidate.draft",
        message: "有稿件但来源正文为空，无法成稿",
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

/* --------------------------------------------------------------------------
 * 7. validateReview —— 审核闸门
 *
 * 只做一致性校验，永远不授权发布（publish_ready 恒为 false）。
 * ----------------------------------------------------------------------- */

export function validateReview(value: unknown): GateResult {
  const issues: GateIssue[] = [];

  const parsed = ReviewSchema.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        code: "invalid_review",
        location: locationOf("review", issue.path),
        message: issue.message,
      });
    }
    return { ok: false, issues };
  }

  const review = parsed.data;
  const checkEntries = Object.entries(review.checks) as [string, CheckResult][];

  if (review.verdict === "pass") {
    if (review.issues.length > 0) {
      issues.push({
        code: "pass_with_issues",
        location: "review.issues",
        message: "verdict=pass 时不允许同时存在 issues",
      });
    }
    for (const [name, result] of checkEntries) {
      if (result === "fail" || result === "uncertain") {
        issues.push({
          code: "check_not_passed",
          location: `review.checks.${name}`,
          message: `verdict=pass 要求全部检查通过，但 ${name} 为 ${result}`,
        });
      }
    }
  }

  if ((review.verdict === "revise" || review.verdict === "hold") && review.issues.length === 0) {
    issues.push({
      code: "missing_issues",
      location: "review.issues",
      message: `verdict=${review.verdict} 必须列出至少一条 issue`,
    });
  }

  return { ok: issues.length === 0, issues };
}

/* --------------------------------------------------------------------------
 * 8. prepareSource —— 来源正文清洗
 * ----------------------------------------------------------------------- */

export const CLEANER_VERSION = "aihot-interpretation-v2-cleaner@1";
export const MAX_CLEAN_TEXT = 30000;

const POPULAR_STORIES_MARKER = "Popular Stories";

export interface ArticleInput {
  id: string;
  revision: number;
  title: string;
  url: string;
  author: string | null;
  published_at: string | null;
  body_text: string | null;
  body_status: string;
  source_name: string;
}

export interface PreparedSource {
  source: Source;
  rawHash: string;
  cleanHash: string;
  cleanerVersion: string;
  warnings: string[];
}

const sha256 = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

const isMacRumorsHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  return host === "macrumors.com" || host.endsWith(".macrumors.com");
};

export function prepareSource(article: ArticleInput): PreparedSource {
  const rawUrl = article.url;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error(`prepareSource: 非法 url：${rawUrl}`);
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(`prepareSource: url 必须是 http/https：${rawUrl}`);
  }
  if (!parsedUrl.host) {
    throw new Error(`prepareSource: url 缺少 host：${rawUrl}`);
  }

  const macRumors = isMacRumorsHost(parsedUrl.hostname);
  const rawText = article.body_text ?? "";
  const rawHash = sha256(rawText);

  const warnings: string[] = [];
  const coverageParts: string[] = [];
  let cleanText = rawText;

  const status = (article.body_status ?? "").trim().toLowerCase();

  if (status !== "ok") {
    cleanText = "";
    coverageParts.push(`not_writable(body_status=${article.body_status})`);
    warnings.push("body_status_not_ok");
  } else if (isBlank(rawText)) {
    cleanText = "";
    coverageParts.push("not_writable(empty_body)");
    warnings.push("empty_body_text");
  } else {
    const markerIndex = rawText.indexOf(POPULAR_STORIES_MARKER);
    if (markerIndex >= 0) {
      const beforeMarker = rawText.slice(0, markerIndex);
      if (macRumors) {
        if (!isBlank(beforeMarker)) {
          cleanText = beforeMarker;
          coverageParts.push("truncated_at_popular_stories");
          warnings.push("truncated_at_popular_stories");
        } else {
          warnings.push("popular_stories_without_leading_text");
        }
      } else {
        warnings.push("popular_stories_kept_non_macrumb_domain");
      }
    }
    if (cleanText.length > MAX_CLEAN_TEXT) {
      cleanText = cleanText.slice(0, MAX_CLEAN_TEXT);
      coverageParts.push(`truncated_at_${MAX_CLEAN_TEXT}_chars`);
      warnings.push(`truncated_at_${MAX_CLEAN_TEXT}_chars`);
    }
    if (coverageParts.length === 0) {
      coverageParts.push("stored_text;images_and_tables_not_verified");
    }
  }

  const cleanHash = sha256(cleanText);

  const source: Source = {
    source_id: article.id,
    url: rawUrl,
    title: article.title,
    source_name: article.source_name,
    author: nullableText(article.author),
    published_at: nullableText(article.published_at),
    revision: article.revision,
    clean_text: cleanText,
    coverage: coverageParts.join(";"),
  };

  return {
    source,
    rawHash,
    cleanHash,
    cleanerVersion: CLEANER_VERSION,
    warnings,
  };
}
