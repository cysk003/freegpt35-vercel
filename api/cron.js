import axios from "axios";
import https from "https";
import { randomUUID } from "crypto";
import { kv } from "@vercel/kv";
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
// Function to attempt the Axios request with retry logic without delay
async function attemptRequestWithRetry(url, config, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await axiosInstance.post(url, {}, config);
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed. Retrying...`);
      lastError = error;
    }
  }
  throw lastError; // Throws the last error encountered if all attempts fail
}

export default async function handler(request, response) {
  const newDeviceId = randomUUID();
  try {
    const myResponse = await attemptRequestWithRetry(
      `${baseUrl}/backend-anon/sentinel/chat-requirements`,
      {
        headers: { "oai-device-id": newDeviceId },
      }
    );
    console.log(`System: Successfully refreshed session ID and token.`);

    const token = myResponse.data.token;
    await kv.hset("session:pro", {oaiDeviceId : newDeviceId, token, refresh: 0});

    return response.json(myResponse.data);
  } catch (error) {
    console.error("Error making request:", error);
    return response.status(500).json({ error: "Failed to refresh session ID and token" });
  }
}