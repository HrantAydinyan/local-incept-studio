import { record } from "rrweb";

let stopFn = null;

let events = [];

function startRecord() {
  console.log("Starting rrweb recording");
  // Don't start if already recording
  if (stopFn) {
    return;
  }

  // Clear any previous events to ensure clean start
  events = [];

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

    slimDOMOptions: {
      script: true,
      comment: true,
      headFavicon: true,
      headWhitespace: true,
      headMetaDescKeywords: true,
      headMetaSocial: true,
      headMetaRobots: true,
      headMetaHttpEquiv: true,
      headMetaAuthorship: true,
      headMetaVerification: true,
      headTitleMutations: true,
    },
  };

  stopFn = record({
    emit: (event) => {
      events.push(event);
    },
    ...formConfig,
  });
}

// startRecord();

const messageHandler = (event) => {
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
      if (stopFn) {
        try {
          stopFn();

          // Only send if we have events
          if (events.length > 0) {
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
