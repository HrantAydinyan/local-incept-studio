const startButton = document.getElementById("start-recording");
const stopButton = document.getElementById("stop-recording");
const openPlayerButton = document.getElementById("open-player");
const recordingTimer = document.getElementById("recording-timer");
const urlWarning = document.getElementById("url-warning");

let interval = null;
let isStoppingRecording = false;

function updateTimer(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  recordingTimer.textContent = `${mins} : ${secs}`;
}

function isValidUrl(url) {
  if (!url) return false;
  return (
    !url.startsWith("chrome://") &&
    !url.startsWith("chrome-extension://") &&
    !url.startsWith("about:") &&
    !url.startsWith("edge://") &&
    !url.startsWith("opera://")
  );
}

function checkCurrentTabValidity() {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs[0] && isValidUrl(tabs[0].url)) {
      startButton.disabled = false;
      startButton.style.opacity = "1";
      startButton.title = "Start Recording";
      urlWarning.style.display = "none";
    } else {
      startButton.disabled = true;
      startButton.style.opacity = "0.5";
      startButton.title = "Cannot record on this page";
      urlWarning.style.display = "block";
    }
  });
}

function startTimerDisplay() {
  // Don't restart timer if we're in the middle of stopping
  if (isStoppingRecording) {
    console.log("Ignoring timer restart during stop");
    return;
  }
  console.log("interval", interval);
  if (interval) clearInterval(interval);

  chrome.storage.local.get(["recordingState"], (result) => {
    const state = result.recordingState;
    if (state && state.isRecording && state.startTime) {
      // Calculate elapsed time
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      updateTimer(elapsed);

      // Update every second
      interval = setInterval(() => {
        const currentElapsed = Math.floor(
          (Date.now() - state.startTime) / 1000
        );
        updateTimer(currentElapsed);
      }, 1000);
      // Update UI state
      startButton.disabled = true;
      stopButton.disabled = false;
      startButton.style.opacity = "0.5";
      stopButton.style.opacity = "1";
    } else {
      // Not recording - check if current tab is valid
      updateTimer(0);
      checkCurrentTabValidity(); // Check validity instead of enabling directly
      stopButton.disabled = true;
      stopButton.style.opacity = "0.5";
    }
  });
}

startButton.addEventListener("click", async () => {
  // Get active tab to start recording (use lastFocusedWindow for side panel)
  const activeTabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  if (!activeTabs[0] || !activeTabs[0].id) {
    console.error("No active tab found");
    return;
  }

  const activeTabId = activeTabs[0].id;

  // Only inject content script into the active tab
  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      files: ["scripts/content.js"],
    });
    console.log(`Content script ensured in tab ${activeTabId}`);
  } catch (error) {
    // Content script might already be loaded, which is fine
    console.log(`Tab ${activeTabId} injection:`, error.message);
  }

  // Wait a bit for content script to initialize
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Save recording state
  await chrome.storage.local.set({
    recordingState: {
      isRecording: true,
      startTime: Date.now(),
    },
  });

  console.log("Recording state saved");
  // Note: startTimerDisplay will be called by storage.onChanged listener

  // Send start message to active tab
  await chrome.scripting.executeScript({
    target: { tabId: activeTabId },
    func: () => {
      window.postMessage({ type: "start-recording" }, "*");
    },
  });
});

stopButton.addEventListener("click", async () => {
  console.log("Stop button clicked");

  // Set flag to prevent timer from restarting
  isStoppingRecording = true;
  // Stop the timer immediately
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  updateTimer(0);

  // Update UI immediately
  startButton.disabled = false;
  stopButton.disabled = true;
  startButton.style.opacity = "1";
  stopButton.style.opacity = "0.5";

  // Notify background that recording session has ended
  chrome.runtime.sendMessage({ type: "recording-stopped" });

  // Clear recording state
  await chrome.storage.local.set({
    recordingState: {
      isRecording: false,
      startTime: null,
    },
  });

  console.log("Recording state cleared");

  // Reset flag immediately after storage is set
  isStoppingRecording = false;

  // Send stop message to active tab with isFinalRecording flag
  try {
    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (tabs[0] && tabs[0].id) {
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          window.postMessage(
            { type: "stop-recording", isFinalRecording: true },
            "*"
          );
        },
      });
      console.log("Stop recording message sent to tab:", tabs[0].id);
    } else {
      console.error("No active tab found");
    }
  } catch (error) {
    console.error("Error stopping recording:", error);
  }
});

openPlayerButton.addEventListener("click", () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("player/player.html"),
  });
});

// Initialize timer display on popup load
startTimerDisplay();

// Listen for storage changes (in case recording state changes from background)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.recordingState) {
    const newValue = changes.recordingState.newValue;
    console.log("Storage changed:", newValue);

    // Only call startTimerDisplay if recording state changed to true
    // If it changed to false, don't restart the timer
    if (newValue && newValue.isRecording) {
      console.log("Starting timer from storage change");
      startTimerDisplay();
    } else if (newValue && !newValue.isRecording) {
      // Recording stopped - ensure timer is stopped
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      updateTimer(0);
      checkCurrentTabValidity();
      stopButton.disabled = true;
      stopButton.style.opacity = "0.5";
    }
  }
});

// Listen for tab changes to update button state
chrome.tabs.onActivated.addListener(() => {
  chrome.storage.local.get(["recordingState"], (result) => {
    const state = result.recordingState;
    // Only check validity if not currently recording
    if (!state || !state.isRecording) {
      checkCurrentTabValidity();
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the updated tab is the active one
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id === tabId && changeInfo.url) {
      chrome.storage.local.get(["recordingState"], (result) => {
        const state = result.recordingState;
        // Only check validity if not currently recording
        if (!state || !state.isRecording) {
          checkCurrentTabValidity();
        }
      });
    }
  });
});
