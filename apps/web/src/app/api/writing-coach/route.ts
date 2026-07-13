import { NextResponse } from "next/server";
import { z } from "zod";
import { createOllamaClient, writingCoachPrompt } from "@rhodes/ai";
import { OLLAMA_FAST_MODEL } from "@rhodes/shared/constants";
import { withSecurityHeaders } from "@/lib/api/security-headers";

const writingCoachSchema = z.object({
  context_label: z.string().min(1).max(200),
  text: z.string().min(20).max(4000),
});

type WritingCoachResult = {
  needs_improvement: boolean;
  feedback: string;
  improved_text: string;
};

function parseWritingCoachResult(raw: string): WritingCoachResult | null {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as WritingCoachResult;
    if (typeof parsed.needs_improvement !== "boolean") return null;
    return {
      needs_improvement: parsed.needs_improvement,
      feedback: typeof parsed.feedback === "string" ? parsed.feedback.trim() : "",
      improved_text:
        typeof parsed.improved_text === "string" ? parsed.improved_text.trim() : "",
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = writingCoachSchema.safeParse(body);

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  try {
    const ollama = createOllamaClient();
    const raw = await ollama.generate(
      writingCoachPrompt({
        contextLabel: parsed.data.context_label,
        text: parsed.data.text,
      }),
      OLLAMA_FAST_MODEL,
    );

    const result = parseWritingCoachResult(raw);
    if (!result) {
      return withSecurityHeaders(
        NextResponse.json({ error: "Couldn't review writing" }, { status: 503 }),
      );
    }

    return withSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Writing coach failed",
        },
        { status: 503 },
      ),
    );
  }
}
