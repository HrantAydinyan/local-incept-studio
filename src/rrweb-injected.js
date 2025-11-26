import { record } from "rrweb";

let stopFn = null;

let events = [];

function startRecord() {
  // Don't start if already recording
  if (stopFn) {
    console.log("Recording already in progress");
    return;
  }

  const formConfig = {
    // checkoutEveryNth: 10000,
    checkoutEveryNms: 600000,

    sampling: {
      input: "last", // Record only last input value
      mousemove: true, // Disable high-frequency mouse move events
      mouseInteraction: false, // Disable click, dblclick, mousedown, etc (optional)
      scroll: 150, // Throttle scroll events (ms)
    },

    blockClass: "rr-block",
    ignoreClass: "rr-ignore",
  };
  console.log("start Recording");
  stopFn = record({
    emit: (event) => {
      events.push(event);
      console.log("Event captured. Total events:", events.length);
    },
    ...formConfig,
  });
  console.log("Recording started successfully");
}

// startRecord();

const messageHandler = (event) => {
  console.log("message received", event);
  if (event.source !== window) return;
  const data = event.data;
  const eventHandler = {
    ["start-recording"]: () => {
      startRecord(data.config || {});
      // Notify that recording has started
      window.postMessage(
        {
          source: "rrweb-started",
        },
        "*"
      );
    },
    ["stop-recording"]: () => {
      console.log("Stop recording requested. Current state:", {
        hasStopFn: !!stopFn,
        eventsCount: events.length,
        isFinalRecording: data.isFinalRecording,
      });

      if (stopFn) {
        try {
          console.log("Stopping recording with", events.length, "events");
          stopFn();

          // Only send if we have events
          if (events.length > 0) {
            console.log("Sending events to content script:", events.length);
            // Generate unique ID for this recording session
            const recordingId = `${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}`;
            window.postMessage(
              {
                source: "rrweb-stop",
                events: [...events], // Send a copy
                recordingId: recordingId,
                isFinalRecording: data.isFinalRecording || false,
              },
              "*"
            );
            events = []; // Clear events after sending
          } else {
            console.warn(
              "No events to save, recording was too short or not started"
            );
          }
        } catch (e) {
          console.error("Error stopping recording:", e);
        }
      } else {
        console.warn("No active recording to stop");
      }
      stopFn = null;
      // Don't remove event listener anymore to allow re-recording
      // window.removeEventListener("message", messageHandler);
    },
  };
  if (eventHandler[data.type]) eventHandler[data.type]();
};

window.addEventListener("message", messageHandler);
