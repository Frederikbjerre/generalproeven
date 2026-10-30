import { callJson, errorResponse } from "@/lib/claude";
import { demoABReport, fakeLatency, isDemo } from "@/lib/demo";
import { AB_REPORT_SYSTEM, abReportUser } from "@/lib/prompts";
import { ABReportSchema, clamp, type ABReaction, type Persona } from "@/lib/schemas";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { materialA, materialB, items } = (await req.json()) as {
    materialA: string;
    materialB: string;
    items: { persona: Persona; reaction: ABReaction }[];
  };
  if (!items?.length) {
    return Response.json({ error: "Ingen reaktioner at lave rapport på." }, { status: 400 });
  }
  if (isDemo()) {
    await fakeLatency();
    return Response.json({ report: demoABReport(items), demo: true });
  }
  try {
    const report = await callJson({
      schema: ABReportSchema,
      system: AB_REPORT_SYSTEM,
      user: abReportUser(materialA, materialB, items),
    });
    return Response.json({
      report: { ...report, score_a: clamp(report.score_a, 0, 100), score_b: clamp(report.score_b, 0, 100) },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
