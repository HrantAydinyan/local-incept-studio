import rrwebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";
import { pack } from "rrweb";

let player = null;

const loadButton = document.getElementById("load-recording");
const fileInput = document.getElementById("file-input");
const clearAllButton = document.getElementById("clear-all");
const playerContainer = document.getElementById("player-container");
const recordingsTbody = document.getElementById("recordings-tbody");
const noRecordings = document.getElementById("no-recordings");
const recordingsTable = document.getElementById("recordings-table");

let currentRecordings = {};

loadButton.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const events = JSON.parse(e.target.result);
      playRecording(events);
    } catch (error) {
      console.error("Error loading recording:", error);
      alert("Failed to load recording. Please check the file format.");
    }
  };

  reader.readAsText(file);
});

clearAllButton.addEventListener("click", () => {
  if (confirm("Are you sure you want to delete all recordings?")) {
    chrome.runtime.sendMessage({ type: "clear-all-recordings" }, (resp) => {
      loadRecordingsTable();
      playerContainer.innerHTML = "";
    });
  }
});

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function playRecording(events) {
  // Clear previous player if exists
  if (player) {
    playerContainer.innerHTML = "";
  }

  // Scroll to player
  playerContainer.scrollIntoView({ behavior: "smooth" });

  // Create new player
  player = new rrwebPlayer({
    target: playerContainer,
    props: {
      events,
      autoPlay: true,
      width: 1024,
      height: 576,
    },
  });
}

function loadRecordingsTable() {
  chrome.runtime.sendMessage({ type: "get-all-sessions" }, (resp) => {
    if (!resp || !resp.success) {
      console.error("Failed to load sessions", resp && resp.error);
      currentRecordings = {};
    } else {
      const sessions = resp.sessions || [];
      currentRecordings = {};

      // Store sessions with their combined recordings
      sessions.forEach((session) => {
        currentRecordings[session.sessionId] = session;
      });
    }
    const sessionIds = Object.keys(currentRecordings);

    // Clear table
    recordingsTbody.innerHTML = "";

    if (sessionIds.length === 0) {
      noRecordings.style.display = "block";
      recordingsTable.style.display = "none";
    } else {
      noRecordings.style.display = "none";
      recordingsTable.style.display = "table";

      // Already sorted by timestamp in getAllSessions

      // Populate table
      sessionIds.forEach((sessionId) => {
        const session = currentRecordings[sessionId];
        const firstRecording = session.recordings[0];
        const tabCount = session.recordings.length;
        const row = document.createElement("tr");

        row.innerHTML = `
          <td>${tabCount} tab${tabCount > 1 ? "s" : ""}</td>
          <td>${firstRecording.title || "Untitled"}</td>
          <td class="url-cell" title="${firstRecording.url}">${
          firstRecording.url || "N/A"
        }</td>
          <td>${session.totalEvents}</td>
          <td>${formatDate(session.firstTimestamp)}</td>
          <td>
            <button class="play-btn" data-session-id="${sessionId}">Play</button>
            <button class="download-btn" data-session-id="${sessionId}">Download</button>
            <button class="delete-btn" data-session-id="${sessionId}">Delete</button>
          </td>
        `;

        recordingsTbody.appendChild(row);
      });

      // Add event listeners to play buttons
      document.querySelectorAll(".play-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const sessionId = e.target.dataset.sessionId;
          const session = currentRecordings[sessionId];
          if (session && session.recordings) {
            // Combine all events from all recordings in the session
            const allEvents = [];
            session.recordings.forEach((recording) => {
              allEvents.push(...recording.events);
            });
            // Sort events by timestamp
            allEvents.sort((a, b) => a.timestamp - b.timestamp);
            playRecording(allEvents);
          }
        });
      });

      // Add event listeners to download buttons
      document.querySelectorAll(".download-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const sessionId = e.target.dataset.sessionId;
          const session = currentRecordings[sessionId];
          if (session && session.recordings) {
            // Combine all events from all recordings in the session
            const allEvents = [];
            session.recordings.forEach((recording) => {
              allEvents.push(...recording.events);
            });
            // Sort events by timestamp
            allEvents.sort((a, b) => a.timestamp - b.timestamp);

            // Pack events using rrweb's pack function
            const packedEvents = pack(allEvents);

            // Create filename with timestamp
            const timestamp = new Date(session.firstTimestamp)
              .toISOString()
              .replace(/[:.]/g, "-");
            const filename = `recording-${timestamp}.json`;

            // Create blob and download
            const jsonString = JSON.stringify(packedEvents);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        });
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const sessionId = e.target.dataset.sessionId;
          const session = currentRecordings[sessionId];
          if (session) {
            // Delete all recordings in the session
            if (
              confirm(
                `Delete this recording session (${
                  session.recordings.length
                } recording${session.recordings.length > 1 ? "s" : ""})?`
              )
            ) {
              let deleteCount = 0;
              session.recordings.forEach((recording) => {
                chrome.runtime.sendMessage(
                  { type: "delete-recording", recordingId: recording.id },
                  (resp) => {
                    deleteCount++;
                    if (deleteCount === session.recordings.length) {
                      loadRecordingsTable();
                      if (player) {
                        playerContainer.innerHTML = "";
                      }
                    }
                  }
                );
              });
            }
          }
        });
      });
    }
  });
}

// Load recordings table on page load
loadRecordingsTable();
