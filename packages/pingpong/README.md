# @cuecue/pingpong

A Cuecue output that publishes the app's commands to a [Pingpong](https://github.com/folkloreinc/pingpong) channel, through Pingpong's signed HTTP API (`POST /v1/messages`).

```js
import Application from '@cuecue/app';
import { Output as PingpongOutput } from '@cuecue/pingpong';

const app = new Application(definition);
app.output(new PingpongOutput());
app.start();
```

Each command becomes a message on the channel: the event is the command (`cue`, `start`, `state`…), and the data is `{ command, args }`, as `@cuecue/pubnub`'s output sends them. A client receives it with `@pingpong-io/client`, or any Socket.IO client subscribed to the channel.

## Settings

| Option    | Environment variable | Default         |                                                                         |
| --------- | -------------------- | --------------- | ----------------------------------------------------------------------- |
| `url`     | `PINGPONG_URL`       |                 | The Pingpong server, such as `https://pingpong.example.com`             |
| `key`     | `PINGPONG_KEY`       |                 | The project's public key (`pk_…`)                                       |
| `secret`  | `PINGPONG_SECRET`    |                 | The project's secret (`sk_…`). It only signs requests: it is never sent |
| `channel` | `PINGPONG_CHANNEL`   | `cuecue:output` | The channel, or an array of channels                                    |
| `timeout` |                      | `5000`          | How long to wait for Pingpong, in milliseconds                          |
| `logger`  |                      | `console`       | Where failed publishes are logged, with `logger.error()`                |

The output throws when it is created without a URL, a key or a secret.

Like `@cuecue/pubnub`'s output, it takes `transformCommand(command, args)` (return `false` to cancel a command, or `{ command, args }` to change it), `acceptCommand(command, args)` and `transformMessage(message)`.

## Delivery

- Messages leave one at a time, in the order of the commands, so that clients receive a `cue` before the `uncue` that follows it.
- A failed publish (Pingpong refuses it, is down or doesn't answer in time) is logged and never rejects: the show keeps running. Clients that reconnect should reload the current state from the app's HTTP API.
- There is no input yet, since Pingpong doesn't relay client messages: commands come in through `@cuecue/http` (`POST /commands`) or OSC.
