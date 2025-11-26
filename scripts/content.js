window.addEventListener("load", () => {
  const scriptEl = document.createElement("script");
  scriptEl.src = chrome.runtime.getURL("src/rrweb-injected.js");
  document.documentElement.appendChild(scriptEl);
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start-recording-auto") {
    window.postMessage({ type: "start-recording" }, "*");
    sendResponse({ success: true });
  }

  if (request.action === "stop-recording-auto") {
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
    const isFinalRecording = msg.data.isFinalRecording || false;

    if (!events || events.length === 0) {
      console.warn("No events to save");
      return;
    }

    // Send save request to background (background will attach tabId)
    chrome.runtime.sendMessage(
      {
        type: "save-recording",
        recordingId,
        events,
        url: window.location.href,
        title: document.title,
        isFinalRecording: isFinalRecording,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error sending save-recording message:",
            chrome.runtime.lastError
          );
          return;
        }
      }
    );
  }
});
