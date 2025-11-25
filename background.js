let events = [];

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "rrweb-event") {
    events.push(msg.event);
    console.log("eeeeeeezzzzzzzz", events);
    // chrome.storage.local.set({ rrweb_events: events });
  }
});
