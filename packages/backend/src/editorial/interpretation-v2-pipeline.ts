import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  CandidateSchema,
  ReviewSchema,
  validateCandidate,
  validateReview,
  type Source,
} from "./interpretation-v2-core.ts";

export type PipelineState =
  | "running"
  | "awaiting_gpt_review"
  | "hold"
  | "skip"
  | "error";

export type PipelineCall = {
  stage: "write" | "review" | "repair";
  callId: string;
  status: "started" | "done" | "error";
  receiptId?: number;
  error?: string;
};

export type PipelineReview = {
  candidateHash: string;
  review: unknown;
};

export type PipelineRecord = {
  version: 2;
  key: string;
  inputHash: string;
  promptHash: string;
  modelName: string;
  sources: Source[];
  createdAt: string;
  updatedAt: string;
  state: PipelineState;
  candidate: unknown | null;
  candidateHash: string | null;
  issues: unknown[];
  reviews: PipelineReview[];
  calls: PipelineCall[];
  repairRounds: number;
  publish_ready: false;
  recordPath: string;
  pendingCall?: string | null;
};

export type InterpretationPipelineOptions = {
  sources: Source[];
  modelName: string;
  prompts: {
    write: string;
    review: string;
    repair: string;
  };
  root: string;
  callModel: (arg: {
    stage: "write" | "review" | "repair";
    system: string;
    user: string;
    callId: string;
  }) => Promise<{ value: unknown; receiptId?: number }>;
  asOf?: string;
};

const StoredRecordSchema = z.object({
  version: z.literal(2),
  key: z.string(),
  inputHash: z.string(),
  promptHash: z.string(),
  modelName: z.string(),
  sources: z.array(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  state: z.enum(["running", "awaiting_gpt_review", "hold", "skip", "error"]),
  candidate: z.unknown().nullable(),
  candidateHash: z.string().nullable(),
  issues: z.array(z.unknown()),
  reviews: z.array(
    z.object({
      candidateHash: z.string(),
      review: z.unknown(),
    }),
  ),
  calls: z.array(
    z.object({
      stage: z.enum(["write", "review", "repair"]),
      callId: z.string(),
      status: z.enum(["started", "done", "error"]),
      receiptId: z.number().optional(),
      error: z.string().optional(),
    }),
  ),
  repairRounds: z.number(),
  publish_ready: z.literal(false),
  recordPath: z.string(),
  pendingCall: z.string().nullable().optional(),
});

type GateIssue = {
  location: string;
  problem: string;
  required_change: string;
};

type ValidationResult = {
  ok: boolean;
  issues: { code: string; location: string; message: string }[];
};

type CallStage = "write" | "review" | "repair";

const sha256 = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const shanghaiDay = (asOf: string): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(asOf));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const atomicWrite = async (filePath: string, value: string): Promise<void> => {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, value, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
};

const candidateSchemaIssues = (value: unknown): GateIssue[] => {
  const parsed = CandidateSchema.safeParse(value);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => ({
    location: issue.path.length ? issue.path.join(".") : "candidate",
    problem: issue.message,
    required_change: issue.message,
  }));
};

const validationIssues = (result: ValidationResult): GateIssue[] =>
  result.issues.map((issue) => ({
    location: issue.location || issue.code || "candidate",
    problem: issue.message,
    required_change: issue.message,
  }));

const reviewSemanticIssues = (value: unknown): GateIssue[] => {
  const parsed = ReviewSchema.safeParse(value);
  if (!parsed.success) return [];
  const issues: GateIssue[] = [];
  for (const issue of parsed.data.issues) {
    const item = isObject(issue) ? issue : undefined;
    const problem = String(
      item?.problem ??
        item?.message ??
        (typeof issue === "string" ? issue : JSON.stringify(issue)),
    );
    issues.push({
      location: String(item?.location ?? item?.code ?? "review.issues"),
      problem,
      required_change: String(
        item?.required_change ?? item?.requiredChange ?? problem,
      ),
    });
  }
  return issues;
};

const reviewVerdict = (value: unknown): string => {
  const parsed = ReviewSchema.safeParse(value);
  return parsed.success ? parsed.data.verdict.toLowerCase() : "";
};

const reviewPasses = (value: unknown): boolean => {
  if (!validateReview(value).ok) return false;
  const parsed = ReviewSchema.safeParse(value);
  return parsed.success && parsed.data.verdict.toLowerCase() === "pass";
};

const systemPrompt = (
  stage: CallStage,
  prompt: string,
  createdAt: string,
): string => {
  const schema =
    stage === "review"
      ? z.toJSONSchema(ReviewSchema)
      : z.toJSONSchema(CandidateSchema);
  return [
    prompt,
    "Trusted run context:",
    `trusted_runtime.as_of=${createdAt}`,
    "trusted_runtime.timezone=Asia/Shanghai",
    "trusted_runtime.publication_authority=none",
    "The following is the required JSON schema:",
    JSON.stringify(schema),
  ].join("\n\n");
};

const userPrompt = (
  stage: CallStage,
  sources: Source[],
  candidate: unknown | null,
  issues: unknown[],
  key: string,
  modelName: string,
  createdAt: string,
): string => {
  const runContext = {
    key,
    modelName,
    createdAt,
    timezone: "Asia/Shanghai",
    protocol: "v2-2",
  };
  if (stage === "write") {
    return JSON.stringify({ sources, run_context: runContext });
  }
  if (stage === "review") {
    const draft = isObject(candidate) ? candidate.draft : undefined;
    return JSON.stringify({
      sources,
      run_context: runContext,
      current_draft: draft,
      current_candidate: candidate,
    });
  }
  return JSON.stringify({
    sources,
    run_context: runContext,
    current_candidate: candidate,
    issues,
  });
};

export async function runInterpretationPipeline(
  options: InterpretationPipelineOptions,
): Promise<PipelineRecord> {
  if (options.modelName !== "MiniMax-M3.1-Flash") {
    throw new Error("Unsupported modelName");
  }
  const createdAt = options.asOf ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(createdAt))) {
    throw new Error("Invalid asOf");
  }
  const normalizedAsOf = new Date(createdAt).toISOString();
  const root = path.resolve(options.root);
  const inputHash = sha256(options.sources);
  const promptHash = sha256(options.prompts);
  const key = sha256({
    sources: options.sources,
    modelName: options.modelName,
    promptHash,
    protocol: "v2-2",
    day: shanghaiDay(normalizedAsOf),
  });
  const recordPath = path.join(root, `${key}.json`);
  const lockPath = path.join(root, `${key}.lock`);
  await mkdir(root, { recursive: true });

  const lock = await open(lockPath, "wx");
  let lockOwned = true;
  let record: PipelineRecord;
  try {
    let existingText: string | null = null;
    try {
      existingText = await readFile(recordPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    let parsedExisting: z.infer<typeof StoredRecordSchema> | null = null;
    if (existingText !== null) {
      let existingJson: unknown;
      try {
        existingJson = JSON.parse(existingText);
      } catch {
        throw new Error("Invalid cache");
      }
      const existingResult = StoredRecordSchema.safeParse(existingJson);
      if (!existingResult.success) throw new Error("Invalid cache");
      parsedExisting = existingResult.data;
    }

    const metadataMatches =
      parsedExisting !== null &&
      parsedExisting.key === key &&
      parsedExisting.inputHash === inputHash &&
      parsedExisting.promptHash === promptHash &&
      parsedExisting.modelName === options.modelName;
    const existingCandidateHash =
      parsedExisting?.candidate === null || parsedExisting?.candidate === undefined
        ? null
        : sha256(parsedExisting.candidate);
    const candidateHashMatches =
      parsedExisting !== null &&
      parsedExisting.candidateHash === existingCandidateHash;
    if (parsedExisting !== null && !metadataMatches) {
      throw new Error("cache identity mismatch");
    }
    if (parsedExisting !== null && !candidateHashMatches) {
      throw new Error("cache identity mismatch");
    }
    const reusable = parsedExisting !== null;

    record = reusable
      ? ({
          ...parsedExisting,
          sources: options.sources,
          publish_ready: false,
          recordPath,
        } as PipelineRecord)
      : ({
          version: 2,
          key,
          inputHash,
          promptHash,
          modelName: options.modelName,
          sources: options.sources,
          createdAt: normalizedAsOf,
          updatedAt: normalizedAsOf,
          state: "running",
          candidate: null,
          candidateHash: null,
          issues: [],
          reviews: [],
          calls: [],
          repairRounds: 0,
          publish_ready: false,
          recordPath,
          pendingCall: null,
        } satisfies PipelineRecord);

    const save = async (): Promise<void> => {
      record.updatedAt = new Date().toISOString();
      record.publish_ready = false;
      await atomicWrite(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    };

    if (reusable && record.state === "running" && record.pendingCall) {
      record.state = "hold";
      record.issues = [
        {
          code: "manual_receipt_reconciliation",
          location: "calls",
          message: "manual_receipt_reconciliation",
        },
      ];
      await save();
      return record;
    }

    if (reusable && record.state === "awaiting_gpt_review") {
      const candidateValidation = validateCandidate(record.candidate, options.sources);
      const matchingReview = record.reviews.find(
        (entry) => entry.candidateHash === record.candidateHash,
      );
      const reviewValidation = matchingReview
        ? validateReview(matchingReview.review)
        : { ok: false, issues: [] };
      if (
        !candidateValidation.ok ||
        !reviewValidation.ok ||
        !matchingReview ||
        !reviewPasses(matchingReview.review)
      ) {
        record.state = "hold";
        record.issues = [
          {
            code: "cached_review_unverified",
            location: "reviews",
            message: "Cached candidate or GPT review did not pass independent validation.",
          },
        ];
        await save();
      }
      return record;
    }

    if (reusable && ["hold", "skip", "error"].includes(record.state)) {
      await save();
      return record;
    }

    const hasMainText = options.sources.some(
      (source) => typeof source.clean_text === "string" && source.clean_text.trim().length > 0,
    );
    if (!hasMainText) {
      record.state = "hold";
      record.issues = [
        {
          code: "missing_main_text",
          location: "sources",
          message: "No source with non-empty clean_text was provided.",
        },
      ];
      await save();
      return record;
    }

    const call = async (
      stage: CallStage,
      candidate: unknown | null,
      issues: unknown[],
    ): Promise<{ ok: boolean; value?: unknown; error?: string }> => {
      if (record.calls.length >= 6) return { ok: false, error: "request_budget_exhausted" };
      const callId = `${key}:${String(record.calls.length).padStart(2, "0")}`;
      const callEntry: PipelineCall = {
        stage,
        callId,
        status: "started",
      };
      record.calls.push(callEntry);
      record.pendingCall = callId;
      await save();
      try {
        const result = await options.callModel({
          stage,
          system: systemPrompt(
            stage,
            options.prompts[stage],
            record.createdAt,
          ),
          user: userPrompt(
            stage,
            options.sources,
            candidate,
            issues,
            key,
            options.modelName,
            record.createdAt,
          ),
          callId,
        });
        callEntry.status = "done";
        if (result.receiptId !== undefined) callEntry.receiptId = result.receiptId;
        record.pendingCall = null;
        return { ok: true, value: result.value };
      } catch {
        callEntry.status = "error";
        callEntry.error = "Error";
        record.pendingCall = null;
        return { ok: false, error: "Error" };
      }
    };

    let candidate = record.candidate;
    let candidateHash = record.candidateHash;
    let repairIssues: GateIssue[] = [];

    const setCandidate = (value: unknown): void => {
      candidate = value;
      candidateHash = value === null ? null : sha256(value);
      record.candidate = value;
      record.candidateHash = candidateHash;
    };

    const candidateProblems = (): GateIssue[] => {
      const schemaProblems = candidateSchemaIssues(candidate);
      if (schemaProblems.length) return schemaProblems;
      const validation = validateCandidate(candidate, options.sources);
      return validationIssues(validation);
    };

    if (candidate === null || candidate === undefined) {
      const result = await call("write", null, []);
      if (!result.ok) {
        record.state = "error";
        record.issues = [
          {
            code: "write_failed",
            location: "calls",
            message: result.error ?? "Error",
          },
        ];
        await save();
        return record;
      }
      setCandidate(result.value);
      await save();
    }

    for (;;) {
    while (true) {
      const problems = candidateProblems();
      if (!problems.length) break;

      if (record.repairRounds >= 2 || record.calls.length >= 6) {
        record.state = "hold";
        record.issues = problems;
        await save();
        return record;
      }

      record.repairRounds += 1;
      repairIssues = problems;
      const result = await call("repair", candidate, repairIssues);
      if (!result.ok) {
        record.state = "error";
        record.issues = [
          {
            code: "repair_failed",
            location: "calls",
            message: result.error ?? "Error",
          },
        ];
        await save();
        return record;
      }
      setCandidate(result.value);
      record.issues = repairIssues;
      await save();
    }

    if (candidateHash === null) {
      record.state = "hold";
      record.issues = [
        {
          code: "missing_candidate",
          location: "candidate",
          message: "Candidate is missing.",
        },
      ];
      await save();
      return record;
    }

    const candidateDecision =
      isObject(candidate) && typeof candidate.decision === "string"
        ? candidate.decision.toLowerCase()
        : "";
    if (candidateDecision === "skip" || candidateDecision === "hold") {
      record.state = candidateDecision;
      record.issues = [];
      await save();
      return record;
    }

    let matchingReview = record.reviews.find(
      (entry) => entry.candidateHash === candidateHash,
    );
    if (!matchingReview) {
      if (record.calls.length >= 6) {
        record.state = "hold";
        record.issues = [
          {
            code: "review_budget_exhausted",
            location: "calls",
            message: "The request budget was exhausted before review.",
          },
        ];
        await save();
        return record;
      }
      const result = await call("review", candidate, []);
      if (!result.ok) {
        record.state = "error";
        record.issues = [
          {
            code: "review_failed",
            location: "calls",
            message: result.error ?? "Error",
          },
        ];
        await save();
        return record;
      }
      matchingReview = { candidateHash, review: result.value };
      record.reviews.push(matchingReview);
      await save();
    }

    const reviewValidation = validateReview(matchingReview.review);
    if (!reviewValidation.ok) {
      const reviewProblems = validationIssues(reviewValidation);
      if (record.repairRounds >= 2 || record.calls.length >= 6) {
        record.state = "hold";
        record.issues = reviewProblems;
        await save();
        return record;
      }
      record.repairRounds += 1;
      const result = await call("repair", candidate, reviewProblems);
      if (!result.ok) {
        record.state = "error";
        record.issues = [
          {
            code: "repair_failed",
            location: "calls",
            message: result.error ?? "Error",
          },
        ];
        await save();
        return record;
      }
      setCandidate(result.value);
      record.issues = reviewProblems;
      await save();
      continue;
    }

    const verdict = reviewVerdict(matchingReview.review);
    if (verdict === "hold" || verdict === "skip") {
      record.state = verdict;
      record.issues = reviewSemanticIssues(matchingReview.review);
      await save();
      return record;
    }

    const reviewProblems = reviewSemanticIssues(matchingReview.review);
    if (reviewProblems.length) {
      if (record.repairRounds >= 2 || record.calls.length >= 6) {
        record.state = "hold";
        record.issues = reviewProblems;
        await save();
        return record;
      }
      record.repairRounds += 1;
      const result = await call("repair", candidate, reviewProblems);
      if (!result.ok) {
        record.state = "error";
        record.issues = [
          {
            code: "repair_failed",
            location: "calls",
            message: result.error ?? "Error",
          },
        ];
        await save();
        return record;
      }
      setCandidate(result.value);
      record.issues = reviewProblems;
      await save();
      continue;
    }
    if (verdict !== "pass") {
      record.state = "hold";
      record.issues = [
        {
          code: "invalid_review_verdict",
          location: "review.verdict",
          message: `Unsupported review verdict: ${verdict || "missing"}.`,
        },
      ];
      await save();
      return record;
    }

    record.state = "awaiting_gpt_review";
    record.issues = [];
    await save();
    return record;
    }
  } finally {
    if (lockOwned) {
      await lock.close().catch(() => undefined);
      await unlink(lockPath).catch(() => undefined);
      lockOwned = false;
    }
  }
}