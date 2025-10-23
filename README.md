# effect-ax

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Telegram integration

The chat runtime is Effect-based and accepts pluggable clients. To run a Telegram bot:

```ts
import { Effect } from "effect";
import {
  ChatHandlerTag,
  makeChatApp,
  makeTelegramClientLayer,
} from "effect-ax";

const chatApp = makeChatApp();

const program = chatApp.start.pipe(
  Effect.provideService(ChatHandlerTag, (message) =>
    Effect.log(`Received ${message.text}`),
  ),
  Effect.provide(
    makeTelegramClientLayer({ botToken: process.env.TELEGRAM_TOKEN! }),
  ),
);

Effect.runFork(program);
```

The `makeTelegramClientLayer` helper wraps [Telegraf](https://telegraf.js.org/) under the hood, so you can swap out other transports without changing the app logic.
