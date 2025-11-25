const startButton = document.getElementById("start-recording");
const stopButton = document.getElementById("stop-recording");
const recordingTimer = document.getElementById("recording-timer");

let interval = null;
function startStopwatch(onTick) {
  let seconds = 0;

  interval = setInterval(() => {
    seconds++;
    onTick(seconds);
  }, 1000);

  return interval;
}

function stopTimer(interval) {
  clearInterval(interval);
}

function updateTimer(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  recordingTimer.textContent = `${mins}:${secs}`;
}

startButton.addEventListener("click", () => {
  //   console.log("Recording started");
  //   startStopwatch((sec) => {
  //     console.log("Left:", sec);
  //     updateTimer(sec);
  //   });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        window.postMessage({ type: "start-recording" }, "*");
      },
    });
  });
});

stopButton.addEventListener("click", () => {
  console.log("Recording stopped");
  //   stopTimer(interval);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        window.postMessage({ type: "stop-recording" }, "*");
      },
    });
  });
});

chrome.storage.local.get(["rrweb_events"], ({ rrweb_events }) => {
  console.log("Events:", rrweb_events);
});
