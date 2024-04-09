import axios from "axios";
import https from "https";
import { randomUUID } from "crypto";
import { createClient } from "@vercel/kv";

const baseUrl = "https://chat.openai.com";

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

export default async function handler(request, response) {
  let redis;
  // 如果使用了Upstash, 就
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

  const sessionsArr = [];
  const promises = [];
  let errorCount = 0;
  const SessionNum = 16;

  for (let i = 0; i < SessionNum; i++) {
    const newDeviceId = randomUUID();
    const promise = new Promise(async (resolve, reject) => {
      setTimeout(async () => {
        try {
          const myResponse = await axiosInstance.post(
            `${baseUrl}/backend-anon/sentinel/chat-requirements`,
            {},
            {
              headers: { "oai-device-id": newDeviceId },
            }
          );
          console.log(`系统: 成功获取会话 ID 和令牌。`);

          const token = myResponse.data.token;
          resolve({ oaiDeviceId: newDeviceId, token });
        } catch (error) {
          console.error("发起请求时出错:", error.message);
          errorCount++;
          resolve(null);
        }
      }, i * 300);
    });
    promises.push(promise);
  }

  try {
    const results = await Promise.all(promises);
    results.forEach((result) => {
      if (result !== null) {
        sessionsArr.push(result);
      }
    });

    if (errorCount === SessionNum) {
      return response.status(500).json({ error: "获取会话 ID 和令牌失败" });
    }

    await redis.hset("session:pro", {
      refresh: 0,
      sessionArr: sessionsArr,
    });

    return response.json({ message: "成功获取并存储会话信息" });
  } catch (error) {
    return response.status(500).json({ error: "获取会话 ID 和令牌失败" });
  }
}
