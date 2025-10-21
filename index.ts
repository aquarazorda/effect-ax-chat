import { AxAI, ax, type AxAIService, type AxGen, type AxGenOut } from "@ax-llm/ax";
import { Context, Effect, Layer, Stream } from "effect";

type DropFirst<Args extends readonly unknown[]> =
  Args extends readonly [unknown, ...infer Rest]
    ? Rest extends readonly unknown[]
      ? Rest
      : []
    : [];

/**
 * Encapsulates the configuration accepted by AxAI factory helpers.
 */
export type AxClientOptions = Parameters<typeof AxAI.create>[0];

/**
 * Context tag for accessing an AxAI instance through Effect environments.
 */
export class AxClient extends Context.Tag("effect-ax/AxClient")<
  AxClient,
  AxAIService
>() {}

/**
 * Creates a simple Layer that provisions an AxAI instance.
 */
export const AxClientLayer = (options: AxClientOptions): Layer.Layer<AxClient, never, never> =>
  Layer.succeed(AxClient)(AxAI.create(options));

/**
 * Provides an existing AxAI instance to an Effect.
 */
export const provideAxClient = (client: AxAIService) =>
  <A, E, R>(effect: Effect.Effect<A, E, AxClient | R>): Effect.Effect<A, E, R> =>
    Effect.provideService(effect, AxClient, client);

/**
 * Convenience function to construct and provide an AxAI instance inline.
 */
export const withAxClient = (options: AxClientOptions) =>
  <A, E, R>(effect: Effect.Effect<A, E, AxClient | R>): Effect.Effect<A, E, R> =>
    Effect.provideService(effect, AxClient, AxAI.create(options));

/**
 * Executes an Ax program as an Effect, sourcing the AxAI instance from the environment.
 */
export const forward = <
  Args extends readonly unknown[],
  Result,
  Program extends {
    forward: (client: AxAIService, ...args: Args) => PromiseLike<Result>;
  }
>(
  program: Program,
  ...args: Args
): Effect.Effect<Result, unknown, AxClient> =>
  Effect.flatMap(AxClient, (client) =>
    Effect.tryPromise({
      try: () => program.forward(client, ...args),
      catch: (error) => error
    })
  );

/**
 * Executes an Ax program in streaming mode and bridges it to an Effect stream.
 */
export const streamingForward = <
  Args extends readonly unknown[],
  Chunk,
  Iterable extends AsyncIterable<Chunk> | PromiseLike<AsyncIterable<Chunk>>,
  Program extends {
    streamingForward: (client: AxAIService, ...args: Args) => Iterable;
  }
>(
  program: Program,
  ...args: Args
): Stream.Stream<Chunk, unknown, AxClient> =>
  Stream.unwrap(
    Effect.flatMap(AxClient, (client) =>
      Effect.map(
        Effect.tryPromise({
          try: () => Promise.resolve(program.streamingForward(client, ...args)),
          catch: (error) => error
        }),
        (iterable) => Stream.fromAsyncIterable(iterable, (error) => error)
      )
    )
  );

/**
 * Enriches an Ax program with convenience Effect-powered helpers while preserving the original API.
 */
type ProgramForwardArgs<Program extends AxGen<unknown, AxGenOut>> =
  Parameters<Program["forward"]> extends [AxAIService, ...infer Rest]
    ? Rest extends unknown[]
      ? Rest
      : never
    : never;

type ProgramForwardInput<Program extends AxGen<unknown, AxGenOut>> =
  ProgramForwardArgs<Program> extends [infer Value, ...unknown[]]
    ? Value
    : never;

type ProgramForwardOptions<Program extends AxGen<unknown, AxGenOut>> =
  ProgramForwardArgs<Program> extends [unknown, infer Options, ...unknown[]]
    ? Options
    : undefined;

type ProgramStreamingArgs<Program extends AxGen<unknown, AxGenOut>> =
  Program["streamingForward"] extends (client: AxAIService, ...args: infer Rest) => AsyncIterable<unknown>
    ? Rest extends unknown[]
      ? Rest
      : never
    : never;

type ProgramStreamingInput<Program extends AxGen<unknown, AxGenOut>> =
  ProgramStreamingArgs<Program> extends [infer Value, ...unknown[]]
    ? Value
    : never;

type ProgramStreamingOptions<Program extends AxGen<unknown, AxGenOut>> =
  ProgramStreamingArgs<Program> extends [unknown, infer Options, ...unknown[]]
    ? Options
    : undefined;

/**
 * Wraps an Ax program with Effect-friendly helpers while preserving access to the underlying program.
 */
export const wrapProgram = <
  Input,
  Output extends AxGenOut,
  Program extends AxGen<Input, Output>
>(
  program: Program
) => ({
  program,
  forward: (...args: DropFirst<Parameters<Program["forward"]>>) =>
    forward(program, ...args),
  streamingForward: (...args: DropFirst<Parameters<Program["streamingForward"]>>) =>
    streamingForward(program, ...args)
});

export { ax, AxAI };
export * from "@ax-llm/ax";
