import CryptoJS from "crypto-js";

const CHUNK_SIZE = 2 * 1024 * 1024;
const API_ENDPOINT =
  "https://ohg3ei3yr2.execute-api.us-east-1.amazonaws.com/api/v1/records/segments";

function calculateMD5(data) {
  const bytes = new Uint8Array(data);
  const wordArray = CryptoJS.lib.WordArray.create(bytes);
  const hash = CryptoJS.MD5(wordArray);
  return hash.toString(CryptoJS.enc.Hex);
}

function eventsToBinary(events) {
  const encoder = new TextEncoder();
  return encoder.encode(events).buffer;
}

function chunkData(events) {
  const chunks = [];
  let currentChunk = [];

  for (const event of events) {
    currentChunk.push(event);

    const chunkString = JSON.stringify(currentChunk);
    const chunkSize = new Blob([chunkString]).size;

    if (chunkSize > CHUNK_SIZE && currentChunk.length > 1) {
      const lastEvent = currentChunk.pop();
      chunks.push(JSON.stringify(currentChunk));
      currentChunk = [lastEvent];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(JSON.stringify(currentChunk));
  }

  return chunks;
}

async function uploadChunk(chunkData, sessionId, sequenceNumber, token) {
  const binaryData = eventsToBinary(chunkData);
  const checksum = calculateMD5(binaryData);

  const url = new URL(API_ENDPOINT);
  url.searchParams.append("session_id", sessionId);
  url.searchParams.append("sequence_number", sequenceNumber.toString());
  url.searchParams.append("checksum", checksum);
  url.searchParams.append("segment_type", "rrweb");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: chunkData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  return response;
}

export async function uploadRecordingData(events, sessionId, token) {
  if (!token) {
    throw new Error("Token is required for upload");
  }

  if (!sessionId) {
    throw new Error("Session ID is required for upload");
  }

  if (!events || events.length === 0) {
    console.warn("No events to upload");
    return;
  }

  const chunks = chunkData(events);
  for (let i = 0; i < chunks.length; i++) {
    try {
      await uploadChunk(chunks[i], sessionId, i + 1, token);
    } catch (error) {
      console.error(`Error uploading chunk ${i}:`, error);
      throw error;
    }
  }
}

export async function setToken(token) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ apiToken: token }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}
