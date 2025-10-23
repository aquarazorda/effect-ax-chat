import { Effect } from "effect";
import * as S from "effect/Schema";
import { IncomingMessageSchema, OutgoingMessageSchema } from "../clients/MessageSchemas";
import { UserKeySchema } from "./UserKey";
import type { Mailbox, MailboxPolicy } from "./Mailbox";

type IncomingMessage = typeof IncomingMessageSchema.Type;
type OutgoingMessage = typeof OutgoingMessageSchema.Type;

export interface UserContext {
  readonly key: typeof UserKeySchema.Type;
  readonly send: (message: OutgoingMessage) => Effect.Effect<void>;
}

export interface Session {
  readonly key: typeof UserKeySchema.Type;
  readonly mailbox: Mailbox<IncomingMessage>;
}

export interface SessionPolicy {
  readonly idleTtlMillis: number; // idle TTL in milliseconds
  readonly mailbox: MailboxPolicy;
}

export type AgentFactory<R, E = never> = (
  ctx: UserContext,
) => (message: IncomingMessage) => Effect.Effect<void, E, R>;
