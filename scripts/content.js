// Prevent multiple executions of content script
if (window.__inceptStudioContentScriptLoaded__) {
  console.log("Content script already loaded, skipping");
} else {
  window.__inceptStudioContentScriptLoaded__ = true;

  // Track if rrweb script is already injected
  let isRrwebInjected = false;

  // Function to inject rrweb script
  function injectRrwebScript() {
    // Check if already injected
    if (isRrwebInjected) {
      console.log("rrweb-injected.js already injected, skipping");
      return;
    }

    // Check if script element already exists in the DOM
    const existingScript = document.querySelector(
      `script[src="${chrome.runtime.getURL("src/rrweb-injected.js")}"]`
    );
    if (existingScript) {
      console.log("rrweb-injected.js script element already exists");
      isRrwebInjected = true;
      return;
    }

    console.log("injecting rrweb-injected.js");
    const scriptEl = document.createElement("script");
    scriptEl.src = chrome.runtime.getURL("src/rrweb-injected.js");
    document.documentElement.appendChild(scriptEl);
    isRrwebInjected = true;
    console.log("rrweb-injected.js injected");
  }

  // Inject script immediately if document is already loaded, otherwise wait for load event
  if (document.readyState === "loading") {
    console.log("Document still loading, waiting for load event");
    window.addEventListener("load", injectRrwebScript);
  } else {
    console.log("Document already loaded, injecting immediately");
    // Document already loaded (extension installed on already-open page)
    injectRrwebScript();
  }

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
} // End of content script guard
