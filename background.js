import {
  initDB,
  saveRecordingWithId,
  getAllRecordings,
  deleteRecordingById,
  clearAllRecordings,
  getRecordingsBySession,
  getAllSessions,
} from "./src/recordingDB";
import { uploadRecordingData } from "./src/recordingUpload";

let events = [];
let isRecording = false;
let currentRecordingTabId = null;
let currentSessionId = null;
let recordingTabs = new Set(); // Track which tabs have active recordings

// Initialize IndexedDB for background
initDB()
  .then(() => console.log("Recording DB initialized in background"))
  .catch((e) => console.error("DB init error", e));

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Inject content script into all existing tabs on install/update
async function injectContentScriptIntoAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    console.log(`Found ${tabs.length} tabs to inject content script`);

    for (const tab of tabs) {
      // Skip if tab doesn't have ID or URL
      if (!tab.id || !tab.url) {
        continue;
      }

      // Only inject into valid URLs
      if (
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://") &&
        !tab.url.startsWith("about:") &&
        !tab.url.startsWith("edge://") &&
        !tab.url.startsWith("opera://") &&
        !tab.url.startsWith("devtools://")
      ) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["scripts/content.js"],
          });
          console.log(`Injected content script into tab ${tab.id}: ${tab.url}`);
        } catch (error) {
          // Silently ignore errors for tabs that can't be injected
          if (!error.message.includes("Cannot access")) {
            console.log(`Could not inject into tab ${tab.id}:`, error.message);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error injecting content scripts:", error);
  }
}

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension event:", details.reason);

  if (details.reason === "install") {
    console.log(
      "Extension installed - injecting content scripts into existing tabs"
    );
    injectContentScriptIntoAllTabs();
  } else if (details.reason === "update") {
    console.log(
      "Extension updated - injecting content scripts into existing tabs"
    );
    injectContentScriptIntoAllTabs();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "rrweb-event") {
    events.push(msg.event);
    // chrome.storage.local.set({ rrweb_events: events });
  }

  // Handle get-tab-id request from content script
  if (msg.type === "get-tab-id") {
    if (sender.tab) {
      sendResponse({ tabId: sender.tab.id });
    } else {
      sendResponse({ tabId: null });
    }
    return true;
  }

  // Handle recording started
  if (msg.type === "recording-started") {
    isRecording = true;
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      recordingTabs.add(tabId);
      currentRecordingTabId = tabId;
    }
    // Create a new session ID for this recording session
    if (!currentSessionId) {
      currentSessionId = `session-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
    }
    sendResponse({ sessionId: currentSessionId });
    return true;
  }

  // Handle recording stopped/saved
  if (msg.type === "recording-saved") {
    if (sender.tab && sender.tab.id === currentRecordingTabId) {
      // Don't reset isRecording here, let tab switch handle it
    }
  }

  // Save recording into IndexedDB (from content script)
  if (msg.type === "save-recording") {
    const recordingId =
      msg.recordingId ||
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const url = msg.url || "";
    const title = msg.title || "";
    const eventsToSave = msg.events || [];
    const tabId = sender.tab ? sender.tab.id : null;
    const sessionId = currentSessionId || recordingId; // Use current session ID
    const isFinalRecording = msg.isFinalRecording || false;

    saveRecordingWithId(recordingId, eventsToSave, url, title, tabId, sessionId)
      .then(async (rec) => {
        if (tabId) {
          recordingTabs.delete(tabId);
        }

        if (isFinalRecording) {
          const finalSessionId = sessionId;

          currentSessionId = null;
          isRecording = false;
          currentRecordingTabId = null;
          recordingTabs.clear();

          try {
            const token =
              "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0cnVlbGF3OmRlbW8tdXNlciIsImV4cCI6MTc3ODUxNDM3NSwibmJmIjoxNzYyOTYyMzc1LCJpYXQiOjE3NjI5NjIzNzV9.f7p2T1KEi47GYR3GI8TZDM2DXDkdIPUSF2b1J6PDSI7C2eliebzjR35UxdytFSYp_wZk3dBGMXvfsaUcc68uw87XKJKf_jzJIG6hNPH6V4jLVWrmOGDXCuD0w4yeFuJgCXpn3WwFVIbzXDryAhXcYxlhA5ImFTRk5PQ6ToAWWLRMufuWIGixGC_gn8fM1say48Hi_o0IAIDSdptbevOBzn_enlpmQ4OB7h5KWxVb2X3GRrUoiBqQoXd6a_Ufjk_ROWmFCf3Ud1xx3Hfy4KwjVXygI93gR5QY-sFbBh6czBzFJMkVm_oSlqCbPbCU6k3YFm4wB6EckBTk1wPRoZvrPA";
            if (token) {
              const sessionRecordings = await getRecordingsBySession(
                finalSessionId
              );

              const allEvents = [];
              for (const recording of sessionRecordings) {
                if (recording.events && Array.isArray(recording.events)) {
                  allEvents.push(...recording.events);
                }
              }

              if (allEvents.length > 0) {
                await uploadRecordingData(allEvents, finalSessionId, token);
              } else {
                console.warn(
                  `No events to upload for session ${finalSessionId}`
                );
              }
            } else {
              console.warn("No token found, skipping upload");
            }
          } catch (uploadError) {
            console.error("Error uploading recording data:", uploadError);
          }
        }

        sendResponse({ success: true, id: rec.id, sessionId: rec.sessionId });
      })
      .catch((err) => {
        console.error("Error saving recording in background:", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // async
  }

  // Player requests all recordings
  if (msg.type === "get-all-recordings") {
    getAllRecordings()
      .then((recs) => sendResponse({ success: true, recordings: recs }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  // Delete a recording by id
  if (msg.type === "delete-recording") {
    const id = msg.recordingId;
    deleteRecordingById(id)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  // Clear all recordings
  if (msg.type === "clear-all-recordings") {
    clearAllRecordings()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  // Get all sessions (grouped recordings)
  if (msg.type === "get-all-sessions") {
    getAllSessions()
      .then((sessions) => sendResponse({ success: true, sessions }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  // Get recordings by session ID
  if (msg.type === "get-session-recordings") {
    const sessionId = msg.sessionId;
    getRecordingsBySession(sessionId)
      .then((recordings) => sendResponse({ success: true, recordings }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  // Handle recording stopped (mark that we're stopping)
  if (msg.type === "recording-stopped") {
    isRecording = false;
  }
});

// Listen to tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Get tab details
  const tab = await chrome.tabs.get(activeInfo.tabId);

  // If recording is active and user switched to a different tab
  if (
    isRecording &&
    currentRecordingTabId &&
    currentRecordingTabId !== activeInfo.tabId
  ) {
    // Stop recording on the old tab ONLY if it has an active recording
    if (recordingTabs.has(currentRecordingTabId)) {
      try {
        await chrome.tabs.sendMessage(currentRecordingTabId, {
          action: "stop-recording-auto",
        });
      } catch (error) {
        console.error("Error stopping recording on old tab:", error.message);
      }
    }

    // Wait a bit for the stop to complete
    setTimeout(async () => {
      // Start recording on the new tab
      try {
        // Only start on valid URLs (not chrome:// or extension pages)
        if (
          tab.url &&
          !tab.url.startsWith("chrome://") &&
          !tab.url.startsWith("chrome-extension://") &&
          !tab.url.startsWith("about:")
        ) {
          // Check if page is fully loaded
          if (tab.status === "complete") {
            await chrome.tabs.sendMessage(activeInfo.tabId, {
              action: "start-recording-auto",
            });
            currentRecordingTabId = activeInfo.tabId;
          }
        } else {
          currentRecordingTabId = null;
        }
      } catch (error) {
        console.log("Could not start recording on new tab:", error.message);
      }
    }, 500);
  }
});

// Listen to tab updates (when tab URL changes, page loads, etc)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    console.log("Tab updated:", tabId, "URL:", tab.url);

    // If recording is active, handle both cases:
    // 1. Current recording tab navigated to new URL (page reload/navigation)
    // 2. A different tab loaded during recording session
    if (isRecording) {
      const isCurrentTab = tabId === currentRecordingTabId;
      const wasRecording = recordingTabs.has(tabId);

      console.log("Tab status:", {
        tabId,
        isCurrentTab,
        wasRecording,
        currentRecordingTabId,
      });

      // Check if it's a valid URL
      if (
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://") &&
        !tab.url.startsWith("about:")
      ) {
        // If this is the current recording tab or any tab during active recording,
        // restart recording after page load
        if (isCurrentTab || wasRecording || tabId !== currentRecordingTabId) {
          console.log("Starting/restarting recording on tab:", tabId);

          // Wait a bit for content script to be ready
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tabId, {
                action: "start-recording-auto",
              });
              console.log("Auto-started recording on tab:", tabId);
            } catch (error) {
              console.log("Could not start recording on tab:", error.message);
            }
          }, 1000);
        }
      }
    }
  }
});

// Listen to tab creation
chrome.tabs.onCreated.addListener((tab) => {
  console.log("Tab created:", tab.id, "Recording active:", isRecording);
});

// Listen to tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Clean up tracking
  recordingTabs.delete(tabId);
  if (currentRecordingTabId === tabId) {
    currentRecordingTabId = null;
  }
});
