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

  // Handle stop recording and save events
  if (msg.data?.source === "rrweb-stop") {
    const events = msg.data.events;
    console.log("Saving events to storage:", events.length);
    
    chrome.storage.local.set({ recordedEvents: events }, () => {
      console.log("Events saved successfully");
      // Optionally notify the user
      chrome.runtime.sendMessage({
        type: "recording-saved",
        eventCount: events.length,
      });
    });
  }
});
