import { Effect } from "effect";
import type { AgentFactory } from "../../runtime/Session";

export const makeEchoAgent: AgentFactory<never, never> = (ctx) => (m) =>
  Effect.gen(function* () {
    yield* ctx.send({ chatId: m.chatId, text: `You said: ${m.text}` });
  });
