import { callJson, errorResponse } from "@/lib/claude";
import { demoReport, fakeLatency, isDemo } from "@/lib/demo";
import { REPORT_SYSTEM, reportUser } from "@/lib/prompts";
import { ReportSchema, clamp, type DiscussionMessage, type Persona, type Reaction } from "@/lib/schemas";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { material, items, discussion } = (await req.json()) as {
    material: string;
    items: { persona: Persona; reaction: Reaction }[];
    discussion?: DiscussionMessage[];
  };
  if (!items?.length) {
    return Response.json({ error: "Ingen reaktioner at lave rapport på." }, { status: 400 });
  }
  if (isDemo()) {
    await fakeLatency();
    return Response.json({ report: demoReport(items, discussion), demo: true });
  }
  try {
    const report = await callJson({
      schema: ReportSchema,
      system: REPORT_SYSTEM,
      user: reportUser(material, items, discussion),
    });
    return Response.json({ report: { ...report, samlet_score: clamp(report.samlet_score, 0, 100) } });
  } catch (err) {
    return errorResponse(err);
  }
}
