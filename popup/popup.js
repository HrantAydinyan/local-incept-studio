const startButton = document.getElementById("start-recording");
const stopButton = document.getElementById("stop-recording");
const openPlayerButton = document.getElementById("open-player");
const recordingTimer = document.getElementById("recording-timer");
const urlWarning = document.getElementById("url-warning");

let interval = null;

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
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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
  // Get all tabs
  const allTabs = await chrome.tabs.query({});

  // Inject content script into all valid tabs
  for (const tab of allTabs) {
    if (tab.id && tab.url && isValidUrl(tab.url)) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["scripts/content.js"],
        });
        console.log(`Content script injected into tab ${tab.id}`);
      } catch (error) {
        // Content script might already be loaded, which is fine
        console.log(`Tab ${tab.id} injection:`, error.message);
      }
    }
  }

  // Wait a bit for content scripts to initialize
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Get active tab to start recording
  const activeTabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const activeTabId = activeTabs[0].id;

  // Save recording state
  chrome.storage.local.set(
    {
      recordingState: {
        isRecording: true,
        startTime: Date.now(),
      },
    },
    () => {
      startTimerDisplay();

      // Send start message to active tab
      chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        func: () => {
          window.postMessage({ type: "start-recording" }, "*");
        },
      });
    }
  );
});

stopButton.addEventListener("click", () => {
  // Notify background that recording session has ended
  chrome.runtime.sendMessage({ type: "recording-stopped" });

  // Clear recording state
  chrome.storage.local.set(
    {
      recordingState: {
        isRecording: false,
        startTime: null,
      },
    },
    () => {
      if (interval) clearInterval(interval);
      updateTimer(0);
      startButton.disabled = false;
      stopButton.disabled = true;
      startButton.style.opacity = "1";
      stopButton.style.opacity = "0.5";

      // Send stop message to active tab with isFinalRecording flag
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            window.postMessage(
              { type: "stop-recording", isFinalRecording: true },
              "*"
            );
          },
        });
      });
    }
  );
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
    startTimerDisplay();
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
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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
