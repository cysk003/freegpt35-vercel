export const config = {
  supportsResponseStreaming: true,
};

import axios from "axios";
import https from "https";
import { encode } from "gpt-3-encoder";
import { randomUUID } from "crypto";
import { createClient } from "@vercel/kv";

// Constants for the server and API configuration
const baseUrl = "https://chat.openai.com";
const apiUrl = `${baseUrl}/backend-anon/conversation`;

function GenerateCompletionId(prefix = "cmpl-") {
  const characters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const length = 28;

  for (let i = 0; i < length; i++) {
    prefix += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return prefix;
}

async function* chunksToLines(chunksAsync) {
  let previous = "";
  for await (const chunk of chunksAsync) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    previous += bufferChunk;
    let eolIndex;
    while ((eolIndex = previous.indexOf("\n")) >= 0) {
      // line includes the EOL
      const line = previous.slice(0, eolIndex + 1).trimEnd();
      if (line === "data: [DONE]") break;
      if (line.startsWith("data: ")) yield line;
      previous = previous.slice(eolIndex + 1);
    }
  }
}

async function* linesToMessages(linesAsync) {
  for await (const line of linesAsync) {
    const message = line.substring("data :".length);

    yield message;
  }
}

async function* StreamCompletion(data) {
  yield* linesToMessages(chunksToLines(data));
}

// Setup axios instance for API requests with predefined configurations
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "oai-language": "en-US",
    origin: baseUrl,
    pragma: "no-cache",
    referer: baseUrl,
    "sec-ch-ua":
      '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  },
});

// 429故障处理
async function errorHandler(host, redis) {
  const lock = await redis.set("lock_key", "locked", { ex: 10, nx: true });
  if (lock !== "OK") {
    console.log("lock_key is locked");
    // 获取锁失败,直接返回
    return false;
  }

  try {
    console.log("get lock_key success");
    // 获取锁成功,进行错误处理...
    console.log("waitunitUrl:", `https://${host}/api/waitunit`);

    const waitunitResponse = await fetch(`https://${host}/api/waitunit`);
    console.log(
      "waitunitResponse:",
      waitunitResponse.status,
      waitunitResponse.statusText
    );
    const ref = await redis.hset("session:pro", { refresh: 1 });
    console.log("refresh:", ref);
  } finally {
    // 释放锁
    await redis.del("lock_key");
    return true;
  }
}

// Middleware to handle chat completions
export default async function handleChatCompletion(req, res) {
  const host = req.headers.host;
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  } else if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const authToken = process.env.AUTH_TOKEN;
  const reqAuthToken = req.headers.authorization;
  if (authToken && reqAuthToken !== `Bearer ${authToken}`) {
    res.status(401).end();
    return;
  }
  let redis;
  // 如果使用了Upstash, 就使用Upstash
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = createClient({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } else {
    redis = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }

  const { sessionArr, refresh } = await redis.hgetall("session:pro");
  const randomNum = Math.floor(Math.random() * sessionArr.length);
  const { token, oaiDeviceId } = sessionArr[randomNum];

  if (refresh == 1) {
    res.status(429).end();
    return;
  }
  console.log(
    "Request:",
    `${req.method} ${req.originalUrl}`,
    `${req.body?.messages?.length || 0} messages`,
    req.body.stream ? "(stream-enabled)" : "(stream-disabled)"
  );

  try {
    const body = {
      action: "next",
      messages: req.body.messages.map((message) => ({
        author: { role: message.role },
        content: { content_type: "text", parts: [message.content] },
      })),
      parent_message_id: randomUUID(),
      model: "text-davinci-002-render-sha",
      timezone_offset_min: -180,
      suggestions: [],
      history_and_training_disabled: true,
      conversation_mode: { kind: "primary_assistant" },
      websocket_request_id: randomUUID(),
    };

    let promptTokens = 0;
    let completionTokens = 0;

    for (let message of req.body.messages) {
      promptTokens += encode(message.content).length;
    }

    const response = await axiosInstance.post(apiUrl, body, {
      responseType: "stream",
      headers: {
        "oai-device-id": oaiDeviceId,
        "openai-sentinel-chat-requirements-token": token,
      },
    });
    console.log("oaiResponse:", response.status, response.statusText);
    // Set the response headers based on the request type
    if (req.body.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
    } else {
      res.setHeader("Content-Type", "application/json");
    }

    let fullContent = "";
    let requestId = GenerateCompletionId("chatcmpl-");
    let created = Date.now();
    let finish_reason = null;

    for await (const message of StreamCompletion(response.data)) {
      if (message.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{6}$/)) {
        continue;
      }
      const parsed = JSON.parse(message);

      let content = parsed?.message?.content?.parts[0] ?? "";
      let status = parsed?.message?.status ?? "";

      for (let message of req.body.messages) {
        if (message.content === content) {
          content = "";
          break;
        }
      }
      switch (status) {
        case "in_progress":
          finish_reason = null;
          break;
        case "finished_successfully":
          let finish_reason_data =
            parsed?.message?.metadata?.finish_details?.type ?? null;
          switch (finish_reason_data) {
            case "max_tokens":
              finish_reason = "length";
              break;
            case "stop":
            default:
              finish_reason = "stop";
          }
          break;
        default:
          finish_reason = null;
      }

      if (content === "") continue;

      let completionChunk = content.replace(fullContent, "");

      completionTokens += encode(completionChunk).length;

      if (req.body.stream) {
        let response = {
          id: requestId,
          created: created,
          object: "chat.completion.chunk",
          model: "gpt-3.5-turbo",
          choices: [
            {
              delta: {
                content: completionChunk,
              },
              index: 0,
              finish_reason: finish_reason,
            },
          ],
        };

        res.write(`data: ${JSON.stringify(response)}\n\n`);
      }

      fullContent = content.length > fullContent.length ? content : fullContent;
    }

    if (req.body.stream) {
      res.write(
        `data: ${JSON.stringify({
          id: requestId,
          created: created,
          object: "chat.completion.chunk",
          model: "gpt-3.5-turbo",
          choices: [
            {
              delta: {
                content: "",
              },
              index: 0,
              finish_reason: finish_reason,
            },
          ],
        })}\n\n`
      );
    } else {
      res.write(
        JSON.stringify({
          id: requestId,
          created: created,
          model: "gpt-3.5-turbo",
          object: "chat.completion",
          choices: [
            {
              finish_reason: finish_reason,
              index: 0,
              message: {
                content: fullContent,
                role: "assistant",
              },
            },
          ],
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
          },
        })
      );
    }

    res.end();
  } catch (error) {
    let errorMessages;
    if (error.response?.status == 429) {
      console.log("oaiResponse: 429 Too Many Request!");
      errorMessages = "Too Many Request!";
      // 429 故障处理，暂不需要了
      // await errorHandler(host, redis);
    } else if (error.response?.status != undefined) {
      console.log(
        "oaiResponse:",
        error.response?.statusm,
        error.response?.statusText
      );
      errorMessages = error.response?.statusText;
    } else {
      console.log("connect error:", error.message);
      errorMessages = error.message;
    }
    if (!res.headersSent)
      res.writeHead(error.response?.status ?? 502, {
        "Content-Type": "application/json",
      });
    res.write(
      JSON.stringify({
        status: false,
        error: {
          message: errorMessages,
          type: "invalid_request_error",
          origin: error,
        },
      })
    );
    res.end();
  }
}
