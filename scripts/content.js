window.addEventListener("load", () => {
  const scriptEl = document.createElement("script");
  scriptEl.src = chrome.runtime.getURL("src/rrweb-injected.js");
  document.documentElement.appendChild(scriptEl);
});

console.log("11111");
window.addEventListener("message", (msg) => {
  if (msg.data?.source === "rrweb-record") {
    chrome.runtime.sendMessage({
      type: "rrweb-event",
      event: msg.data.event,
    });
  }

  // Handle stop recording and save events with tabId
  if (msg.data?.source === "rrweb-stop") {
    const events = msg.data.events;
    console.log("Saving events to storage:", events.length);

    // Get current tab ID and save events
    chrome.runtime.sendMessage(
      {
        type: "get-tab-id",
      },
      (response) => {
        const tabId = response.tabId;

        // Get existing recordings
        chrome.storage.local.get(["recordings"], (result) => {
          const recordings = result.recordings || {};

          // Save events for this tab with metadata
          recordings[tabId] = {
            events: events,
            url: window.location.href,
            title: document.title,
            timestamp: Date.now(),
          };

          chrome.storage.local.set({ recordings }, () => {
            console.log(`Events saved successfully for tab ${tabId}`);
            // Notify the user
            chrome.runtime.sendMessage({
              type: "recording-saved",
              eventCount: events.length,
              tabId: tabId,
            });
          });
        });
      }
    );
  }
});
