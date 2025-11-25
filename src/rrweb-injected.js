import { record } from "rrweb";

let stopFn = null;

let events = [];

function startRecord() {
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
      // console.log("aaaaaaaaaa", event);
      events.push(event);
      //   window.post Message({ source: "rrweb-record", event }, "*");
    },
    ...formConfig,
  });
}

// startRecord();

const messageHandler = (event) => {
  console.log("message received", event);
  if (event.source !== window) return;
  const data = event.data;
  const eventHandler = {
    ["start-recording"]: () => {
      startRecord(data.config || {});
    },
    ["stop-recording"]: () => {
      if (stopFn) {
        try {
          console.log("stop Recording", events);
          stopFn();
          // Send events to content script to save
          window.postMessage(
            {
              source: "rrweb-stop",
              events: events,
            },
            "*"
          );
          events = []; // Clear events after sending
        } catch (e) {
          //
        }
      }
      window.removeEventListener("message", messageHandler);
    },
  };
  if (eventHandler[data.type]) eventHandler[data.type]();
};

window.addEventListener("message", messageHandler);
