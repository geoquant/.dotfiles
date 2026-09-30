import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const TYPESAFE_PROVIDER_ID = "typesafe";
const TYPESAFE_SYSTEM_ONE_URL = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_TYPESAFE_MODEL = "jev-latest";
const TYPESAFE_MODELS = new Set(["jev-latest", "jev-preview", "jev-1.13.0"]);

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type TypeSafeQuestion = {
  type: "choice" | "noul" | "score";
  instructions: JsonValue;
  criteria?: JsonValue;
};

type TypeSafeToolParams = {
  state: JsonValue;
  questions: Record<string, TypeSafeQuestion>;
  model?: string;
};

function assertJsonValue(value: unknown, path: string): asserts value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonValue(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      assertJsonValue(entry, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`TypeSafe request invalid: ${path} must contain only JSON values.`);
}

function assertTypeSafeQuestions(
  questions: Record<string, TypeSafeQuestion>,
): asserts questions is Record<string, TypeSafeQuestion> {
  const entries = Object.entries(questions);
  if (entries.length === 0) {
    throw new Error("TypeSafe request invalid: questions must contain at least one question.");
  }

  for (const [questionId, question] of entries) {
    if (!questionId.trim()) {
      throw new Error("TypeSafe request invalid: every question id must be non-empty.");
    }
    assertJsonValue(question.instructions, `questions.${questionId}.instructions`);

    if (question.type === "choice") {
      if (
        question.criteria === null ||
        Array.isArray(question.criteria) ||
        typeof question.criteria !== "object" ||
        Object.keys(question.criteria).length === 0
      ) {
        throw new Error(
          `TypeSafe request invalid: Choice question ${questionId} needs a non-empty criteria object.`,
        );
      }
    } else if (question.type === "score") {
      if (!Array.isArray(question.criteria) || question.criteria.length < 2) {
        throw new Error(
          `TypeSafe request invalid: Score question ${questionId} needs at least two criteria levels.`,
        );
      }
    } else if (question.type === "noul") {
      if (
        question.criteria !== undefined &&
        (question.criteria === null ||
          Array.isArray(question.criteria) ||
          typeof question.criteria !== "object")
      ) {
        throw new Error(
          `TypeSafe request invalid: Noul question ${questionId} criteria must be an object when provided.`,
        );
      }
    } else {
      throw new Error(`TypeSafe request invalid: unknown question type for ${questionId}.`);
    }

    if (question.criteria !== undefined) {
      assertJsonValue(question.criteria, `questions.${questionId}.criteria`);
    }
  }
}

function parseTypeSafeModel(model: string | undefined): string {
  const selectedModel = model ?? DEFAULT_TYPESAFE_MODEL;
  if (!TYPESAFE_MODELS.has(selectedModel)) {
    throw new Error(
      `TypeSafe request invalid: model must be jev-latest, jev-preview, or jev-1.13.0; received ${selectedModel}.`,
    );
  }
  return selectedModel;
}

async function readTypeSafeError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body: unknown = await response.json();
    return JSON.stringify(body);
  }
  return (await response.text()).slice(0, 2_000);
}

/** Registers Jev as a typed judgment tool; Jev is not a Pi chat or tool-calling model. */
export default function registerTypeSafeSystemOne(pi: ExtensionAPI) {
  pi.registerProvider(TYPESAFE_PROVIDER_ID, {
    name: "TypeSafe System One",
    baseUrl: "https://api.typesafe.ai",
    apiKey: "$TYPESAFE_API_KEY",
  });

  pi.on("session_start", async (_event, ctx) => {
    if (process.env.TYPESAFE_API_KEY?.trim()) return;

    const apiKey = await ctx.modelRegistry.getApiKeyForProvider(TYPESAFE_PROVIDER_ID);
    if (apiKey?.trim()) {
      process.env.TYPESAFE_API_KEY = apiKey;
      process.env.TYPESAFE_DEFAULT_MODEL ??= DEFAULT_TYPESAFE_MODEL;
    }
  });

  pi.registerTool({
    name: "typesafe_evaluate",
    label: "TypeSafe · Jev",
    description:
      "Ask TypeSafe's Jev System One model narrow typed Choice, Score, or Noul questions about text or structured application state. Jev returns judgments and probabilities; it does not generate prose or replace Pi's active coding model.",
    promptSnippet: "Ask TypeSafe Jev for typed semantic judgments and probabilities",
    promptGuidelines: [
      "Use typesafe_evaluate for semantic Choice, Score, or Noul judgments after applying the TypeSafe skill; keep rules and actions in code.",
      "Do not describe typesafe_evaluate or Jev as Pi's active chat model; Jev is a callable System One judgment model.",
    ],
    parameters: Type.Object({
      state: Type.Unknown({
        description: "Text or structured JSON state Jev should evaluate.",
      }),
      questions: Type.Record(
        Type.String(),
        Type.Object({
          type: Type.Union([
            Type.Literal("choice"),
            Type.Literal("score"),
            Type.Literal("noul"),
          ]),
          instructions: Type.Unknown({
            description: "The complete, narrow judgment for Jev to make.",
          }),
          criteria: Type.Optional(
            Type.Unknown({
              description:
                "Choice option map, Score level array, or optional Noul true/false descriptions.",
            }),
          ),
        }),
        { description: "Named questions; response answers use the same ids." },
      ),
      model: Type.Optional(
        Type.Union(
          [Type.Literal("jev-latest"), Type.Literal("jev-preview"), Type.Literal("jev-1.13.0")],
          { description: "Jev alias or pinned version. Defaults to jev-latest." },
        ),
      ),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const typedParams = params as TypeSafeToolParams;
      assertJsonValue(typedParams.state, "state");
      assertTypeSafeQuestions(typedParams.questions);
      const model = parseTypeSafeModel(typedParams.model);

      const apiKey = await ctx.modelRegistry.getApiKeyForProvider(TYPESAFE_PROVIDER_ID);
      if (!apiKey?.trim()) {
        throw new Error(
          "TypeSafe authentication missing: store a typesafe credential in ~/.pi/agent/auth.json or export TYPESAFE_API_KEY before starting Pi.",
        );
      }

      onUpdate?.({
        content: [{ type: "text", text: `Asking TypeSafe ${model}…` }],
        details: { model },
      });

      const requestSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(TYPESAFE_REQUEST_TIMEOUT_MS)])
        : AbortSignal.timeout(TYPESAFE_REQUEST_TIMEOUT_MS);
      const response = await fetch(TYPESAFE_SYSTEM_ONE_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          state: typedParams.state,
          questions: typedParams.questions,
          model,
        }),
        signal: requestSignal,
      });

      if (!response.ok) {
        const errorBody = await readTypeSafeError(response);
        throw new Error(`TypeSafe API request failed (${response.status}): ${errorBody}`);
      }

      const result: unknown = await response.json();
      assertJsonValue(result, "response");
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });
}
