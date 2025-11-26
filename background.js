import {
  initDB,
  saveRecordingWithId,
  getAllRecordings,
  deleteRecordingById,
  clearAllRecordings,
  getRecordingsBySession,
  getAllSessions,
} from "./src/recordingDB";

let events = [];
let isRecording = false;
let currentRecordingTabId = null;
let currentSessionId = null;
let recordingTabs = new Set(); // Track which tabs have active recordings

// Initialize IndexedDB for background
initDB()
  .then(() => console.log("Recording DB initialized in background"))
  .catch((e) => console.error("DB init error", e));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "rrweb-event") {
    events.push(msg.event);
    console.log("eeeeeeezzzzzzzz", events);
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
      console.log("New recording session started:", currentSessionId);
    }
    console.log("Recording started on tab:", currentRecordingTabId);
    sendResponse({ sessionId: currentSessionId });
    return true;
  }

  // Handle recording stopped/saved
  if (msg.type === "recording-saved") {
    if (sender.tab && sender.tab.id === currentRecordingTabId) {
      console.log("Recording saved for tab:", currentRecordingTabId);
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
      .then((rec) => {
        console.log("Saved recording", rec.id, "for session", rec.sessionId);

        // Remove this tab from recording tabs
        if (tabId) {
          recordingTabs.delete(tabId);
        }
        
        // If this is the final recording (user clicked stop), clear the session
        if (isFinalRecording) {
          console.log(
            "Final recording saved, clearing session:",
            currentSessionId
          );
          currentSessionId = null;
          isRecording = false;
          currentRecordingTabId = null;
          recordingTabs.clear();
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
    console.log("Recording stop requested for session:", currentSessionId);
    // Don't clear session here - wait for final recording to be saved
    // Session will be cleared in save-recording when isFinalRecording=true
    isRecording = false;
  }
});

// Listen to tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log(
    "Tab activated:",
    activeInfo.tabId,
    "Window:",
    activeInfo.windowId
  );

  // Get tab details
  const tab = await chrome.tabs.get(activeInfo.tabId);
  console.log("Switched to tab:", tab.url, tab.title);

  // If recording is active and user switched to a different tab
  if (
    isRecording &&
    currentRecordingTabId &&
    currentRecordingTabId !== activeInfo.tabId
  ) {
    console.log(
      "Tab switched during recording. Stopping old tab, starting new tab..."
    );

    // Stop recording on the old tab ONLY if it has an active recording
    if (recordingTabs.has(currentRecordingTabId)) {
      try {
        await chrome.tabs.sendMessage(currentRecordingTabId, {
          action: "stop-recording-auto",
        });
        console.log("Stopped recording on tab:", currentRecordingTabId);
      } catch (error) {
        console.log("Could not stop recording on old tab:", error.message);
      }
    } else {
      console.log("Old tab", currentRecordingTabId, "has no active recording");
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
            console.log("Started recording on new tab:", activeInfo.tabId);
          } else {
            console.log("Waiting for tab to load:", activeInfo.tabId);
            // Tab will be handled by onUpdated listener when it completes loading
          }
        } else {
          console.log("Cannot record on this type of page:", tab.url);
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
    
    // If recording is active and this is a newly loaded tab, start recording on it
    if (isRecording && tabId !== currentRecordingTabId) {
      console.log("New tab loaded during recording session:", tabId);
      
      // Check if it's a valid URL
      if (
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://") &&
        !tab.url.startsWith("about:")
      ) {
        // Wait a bit for content script to be ready
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, {
              action: "start-recording-auto",
            });
            console.log("Auto-started recording on new tab:", tabId);
          } catch (error) {
            console.log("Could not start recording on new tab:", error.message);
          }
        }, 1000);
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
  console.log("Tab removed:", tabId, "Window:", removeInfo.windowId);
  // Clean up tracking
  recordingTabs.delete(tabId);
  if (currentRecordingTabId === tabId) {
    currentRecordingTabId = null;
  }
});
