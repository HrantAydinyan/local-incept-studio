// import * as rrweb from "rrweb";
import { record } from "rrweb";
// window.__rrweb__ = rrweb; // expose it to the page

console.log("kkkkkk");
// window.__rrweb__.record({
//   emit(event) {
//     console.log("aaaaaaaaaa", event);
//     window.postMessage({ source: "rrweb-record", event }, "*");
//   },
// });
function startRecording() {
  record({
    emit(event) {
      console.log("aaaaaaaaaa", event);
      //   window.postMessage({ source: "rrweb-record", event }, "*");
    },
  });
}

startRecording();
