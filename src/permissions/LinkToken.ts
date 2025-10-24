import { Context, Effect, Layer } from "effect";

export interface LinkTokenVerifier {
  readonly verify: (token: string) => Effect.Effect<boolean>;
}

export class LinkTokenVerifierTag extends Context.Tag(
  "effect-ax/LinkTokenVerifier",
)<LinkTokenVerifierTag, LinkTokenVerifier>() {}

// Default verifier denies all link tokens.
export const makeLinkTokenVerifier = (): LinkTokenVerifier => ({
  verify: () => Effect.succeed(false),
});

export const makeLinkTokenVerifierLayer: Layer.Layer<LinkTokenVerifierTag> =
  Layer.effect(LinkTokenVerifierTag, Effect.succeed(makeLinkTokenVerifier()));
