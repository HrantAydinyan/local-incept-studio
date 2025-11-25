let events = [];

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
});

// Listen to tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log(
    "Tab activated:",
    activeInfo.tabId,
    "Window:",
    activeInfo.windowId
  );

  // Get tab details
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    console.log("Switched to tab:", tab.url, tab.title);
  });
});

// Listen to tab updates (when tab URL changes, page loads, etc)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    console.log("Tab updated:", tabId, "URL:", tab.url);
  }
});

// Listen to tab creation
chrome.tabs.onCreated.addListener((tab) => {
  console.log("Tab created:", tab.id);
});

// Listen to tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log("Tab removed:", tabId, "Window:", removeInfo.windowId);
});
