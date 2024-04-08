const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const https = require("https");
const { randomUUID } = require("crypto");

// Constants for the server and API configuration
const port = 3040;
const baseUrl = "https://chat.openai.com";

// Initialize global variables to store the session token and device ID
let oaiDeviceId;

// 在vercel运行时记录session创建时间 
let sessionStartTime = new Date();

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

// Function to get a new session ID and token from the OpenAI API
async function getNewSessionId(req, res) {
  let newDeviceId = randomUUID();
  try {
    const response = await axiosInstance.post(
      `${baseUrl}/backend-anon/sentinel/chat-requirements`,
      {},
      {
        headers: { "oai-device-id": newDeviceId },
      }
    );
    console.log(
      `System: Successfully refreshed session ID and token.`
    );
    sessionStartTime = new Date();
    oaiDeviceId = newDeviceId;
    res.json(response.data);
  } catch (error) {
    console.error('Error getting new session ID:', error);
    res.status(500).json({ error: 'Failed to get new session ID' });
  }
}

// Middleware to enable CORS and handle pre-flight requests
function enableCORS(req, res, next) {
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
}

// Initialize Express app and use middlewares
const app = express();
app.use(bodyParser.json());
app.use(enableCORS);

// Route to handle POST requests for getting new session ID
app.post("/backend-anon/sentinel/chat-requirements", getNewSessionId);

// Start the server
app.listen(port, () => {
  console.log(`💡 Server is running at http://localhost:${port}`);
});