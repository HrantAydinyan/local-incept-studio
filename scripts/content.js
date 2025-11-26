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
    const isFinalRecording = msg.data.isFinalRecording || false;
    console.log(
      "Content script received stop with events:",
      events?.length,
      "ID:",
      recordingId,
      "Final:",
      isFinalRecording
    );

    if (!events || events.length === 0) {
      console.warn("No events to save");
      return;
    }

    console.log("Saving events to storage:", events.length);

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
        console.log("Background save-recording response:", response);
      }
    );
  }
});
