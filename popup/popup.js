const startButton = document.getElementById("start-recording");
const stopButton = document.getElementById("stop-recording");
const openPlayerButton = document.getElementById("open-player");
const recordingTimer = document.getElementById("recording-timer");

let interval = null;

function updateTimer(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  recordingTimer.textContent = `${mins} : ${secs}`;
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
      // Not recording
      updateTimer(0);
      startButton.disabled = false;
      stopButton.disabled = true;
      startButton.style.opacity = "1";
      stopButton.style.opacity = "0.5";
    }
  });
}

startButton.addEventListener("click", () => {
  // Save recording state
  chrome.storage.local.set(
    {
      recordingState: {
        isRecording: true,
        startTime: Date.now(),
      },
    },
    () => {
      console.log("Recording state saved");
      startTimerDisplay();

      // Send start message to active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            window.postMessage({ type: "start-recording" }, "*");
          },
        });
      });
    }
  );
});

stopButton.addEventListener("click", () => {
  console.log("Recording stopped");

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

      // Send stop message to active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            window.postMessage({ type: "stop-recording" }, "*");
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
