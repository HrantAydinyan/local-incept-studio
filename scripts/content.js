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
});
