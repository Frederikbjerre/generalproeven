import { errorResponse, streamText } from "@/lib/claude";
import { demoStream, demoTurn, isDemo } from "@/lib/demo";
import { discussionTurnUser, personaSystem } from "@/lib/prompts";
import type { DiscussionMessage, Persona, Reaction } from "@/lib/schemas";

export const maxDuration = 60;

type Body = {
  persona: Persona;
  material: string;
  ownReaction?: Reaction;
  transcript: DiscussionMessage[];
  round: number;
  moderatorQuestion?: string;
};

const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };

// Streams one persona's line as plain text.
export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (isDemo()) {
    return new Response(demoStream(demoTurn(body.persona, body.transcript, body.round)), { headers });
  }

  const iterator = streamText({
    system: personaSystem(body.persona),
    user: discussionTurnUser(body),
    effort: "low",
  });

  // Pull the first chunk before responding, so auth/rate-limit errors come back as a JSON error.
  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch (err) {
    return errorResponse(err);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
          controller.enqueue(encoder.encode(next.value));
        }
        controller.close();
      } catch (err) {
        console.error(err);
        controller.error(err);
      }
    },
    cancel() {
      void iterator.return(undefined);
    },
  });
  return new Response(stream, { headers });
}
