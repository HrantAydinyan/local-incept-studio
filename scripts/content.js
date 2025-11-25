window.addEventListener("load", () => {
  const scriptEl = document.createElement("script");
  scriptEl.src = chrome.runtime.getURL("src/rrweb-injected.js");
  document.documentElement.appendChild(scriptEl);
});

console.log("11111");

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start-recording-auto") {
    console.log("Auto-starting recording on this tab");
    window.postMessage({ type: "start-recording" }, "*");
    sendResponse({ success: true });
  }

  if (request.action === "stop-recording-auto") {
    console.log("Auto-stopping recording on this tab");
    window.postMessage({ type: "stop-recording" }, "*");
    sendResponse({ success: true });
  }

  return true;
});

window.addEventListener("message", (msg) => {
  if (msg.data?.source === "rrweb-record") {
    chrome.runtime.sendMessage({
      type: "rrweb-event",
      event: msg.data.event,
    });
  }

  // Handle recording started
  if (msg.data?.source === "rrweb-started") {
    chrome.runtime.sendMessage({
      type: "recording-started",
    });
  }

  // Handle stop recording and save events with unique ID
  if (msg.data?.source === "rrweb-stop") {
    const events = msg.data.events;
    const recordingId = msg.data.recordingId;
    console.log(
      "Content script received stop with events:",
      events?.length,
      "ID:",
      recordingId
    );

    if (!events || events.length === 0) {
      console.warn("No events to save");
      return;
    }

    console.log("Saving events to storage:", events.length);

    // Get current tab ID for metadata
    chrome.runtime.sendMessage(
      {
        type: "get-tab-id",
      },
      (response) => {
        const tabId = response?.tabId || "unknown";
        console.log("Got tab ID:", tabId);

        // Get existing recordings
        chrome.storage.local.get(["recordings"], (result) => {
          const recordings = result.recordings || {};
          console.log("Current recordings:", Object.keys(recordings).length);

          // Save events with unique recording ID
          recordings[recordingId] = {
            events: events,
            url: window.location.href,
            title: document.title,
            timestamp: Date.now(),
            tabId: tabId, // Keep tabId as metadata
          };

          chrome.storage.local.set({ recordings }, () => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error saving to storage:",
                chrome.runtime.lastError
              );
              return;
            }
            console.log(`✅ Events saved successfully with ID ${recordingId}`);
            console.log("Recording details:", {
              recordingId,
              tabId,
              eventsCount: events.length,
              url: window.location.href,
            });

            // Notify the user
            chrome.runtime.sendMessage({
              type: "recording-saved",
              eventCount: events.length,
              tabId: tabId,
              recordingId: recordingId,
            });
          });
        });
      }
    );
  }
});
