const STORAGE_KEY = "VOLLEYVISION_WEB_STATE";

const STAT_LABELS = {
  SERVE_ATTEMPT: "Serve",
  ACE: "Ace",
  SERVE_ERROR: "Serve Error",
  RECEPTION: "Pass",
  RECEPTION_ERROR: "Pass Error",
  SET: "Set",
  ASSIST: "Assist",
  BALL_HANDLING_ERROR: "Ball Handling Error",
  ATTACK: "Attack",
  KILL: "Kill",
  ATTACK_ERROR: "Attack Error",
  DIG: "Dig",
  DEFENSIVE_ERROR: "Defensive Error",
  SOLO_BLOCK: "Solo Block",
  BLOCK_ASSIST: "Block Assist",
  BLOCK_TOUCH: "Block Touch",
  BLOCK_ERROR: "Block Error"
};

const REPORT_STATS = [
  "ACE",
  "SERVE_ERROR",
  "RECEPTION",
  "RECEPTION_ERROR",
  "ASSIST",
  "KILL",
  "ATTACK_ERROR",
  "DIG",
  "SOLO_BLOCK",
  "BLOCK_ASSIST",
  "BLOCK_TOUCH"
];

let state = {
  teamName: "VolleyVision Team",
  players: [],
  games: [],
  events: [],
  currentGameId: null
};

let selectedPlayerId = null;
let currentVideoObjectUrl = null;

const tabs = document.querySelectorAll(".tab-button");
const screens = document.querySelectorAll(".tab-screen");

const video = document.getElementById("gameVideo");
const currentTimeDisplay = document.getElementById("currentTimeDisplay");
const filmTimestamp = document.getElementById("filmTimestamp");

const playerNameInput = document.getElementById("playerNameInput");
const playerNumberInput = document.getElementById("playerNumberInput");
const playerPositionInput = document.getElementById("playerPositionInput");
const addPlayerBtn = document.getElementById("addPlayerBtn");

const playerList = document.getElementById("playerList");
const playerChips = document.getElementById("playerChips");
const selectedPlayerText = document.getElementById("selectedPlayerText");

const gameNameInput = document.getElementById("gameNameInput");
const videoInput = document.getElementById("videoInput");

const homePlayerCount = document.getElementById("homePlayerCount");
const homeGameCount = document.getElementById("homeGameCount");
const homeStatCount = document.getElementById("homeStatCount");
const homeKillCount = document.getElementById("homeKillCount");

const eventLog = document.getElementById("eventLog");
const reportTableBody = document.getElementById("reportTableBody");
const clipFinderList = document.getElementById("clipFinderList");

const teamNameInput = document.getElementById("teamNameInput");
const saveTeamNameBtn = document.getElementById("saveTeamNameBtn");
const resetBtn = document.getElementById("resetBtn");

const undoBtn = document.getElementById("undoBtn");

function makeId(prefix) {
  if (crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      state = JSON.parse(saved);
    } catch {
      saveState();
    }
  }

  if (!Array.isArray(state.players)) state.players = [];
  if (!Array.isArray(state.games)) state.games = [];
  if (!Array.isArray(state.events)) state.events = [];
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const mins = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const secs = String(safeSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function getCurrentGame() {
  return state.games.find(game => game.id === state.currentGameId) || null;
}

function getCurrentGameEvents() {
  if (!state.currentGameId) return [];
  return state.events
    .filter(event => event.gameId === state.currentGameId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function getPlayer(playerId) {
  return state.players.find(player => player.id === playerId);
}

function switchTab(tabName) {
  tabs.forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  screens.forEach(screen => {
    screen.classList.toggle("active", screen.id === tabName);
  });

  renderAll();
}

function updateVideoTime() {
  const time = video.currentTime || 0;
  currentTimeDisplay.textContent = formatTime(time);
  filmTimestamp.textContent = formatTime(time);
}

function addPlayer() {
  const name = playerNameInput.value.trim();
  const number = playerNumberInput.value.trim();
  const position = playerPositionInput.value.trim();

  if (!name || !number) {
    alert("Add at least a player name and jersey number.");
    return;
  }

  state.players.push({
    id: makeId("player"),
    name,
    number,
    position: position || "Player",
    active: true
  });

  playerNameInput.value = "";
  playerNumberInput.value = "";
  playerPositionInput.value = "";

  saveState();
  renderAll();
}

function deletePlayer(playerId) {
  const player = getPlayer(playerId);

  if (!confirm(`Delete ${player ? player.name : "this player"} and their tagged stats?`)) {
    return;
  }

  state.players = state.players.filter(player => player.id !== playerId);
  state.events = state.events.filter(event => event.playerId !== playerId);

  if (selectedPlayerId === playerId) {
    selectedPlayerId = null;
  }

  saveState();
  renderAll();
}

function loadVideoFile(file) {
  if (!file) return;

  if (currentVideoObjectUrl) {
    URL.revokeObjectURL(currentVideoObjectUrl);
  }

  currentVideoObjectUrl = URL.createObjectURL(file);
  video.src = currentVideoObjectUrl;
  video.load();

  const gameName = gameNameInput.value.trim() || file.name || "Volleyball Game";

  const newGame = {
    id: makeId("game"),
    name: gameName,
    fileName: file.name,
    date: new Date().toISOString(),
    createdAt: Date.now()
  };

  state.games.unshift(newGame);
  state.currentGameId = newGame.id;

  gameNameInput.value = "";

  saveState();
  renderAll();

  alert("Video loaded. Pick a player, then tap stats while watching film.");
}

function tagStat(statType) {
  if (!state.currentGameId) {
    alert("Load a game video first.");
    return;
  }

  if (!selectedPlayerId) {
    alert("Pick a player first.");
    return;
  }

  const event = {
    id: makeId("event"),
    gameId: state.currentGameId,
    playerId: selectedPlayerId,
    statType,
    timestamp: video.currentTime || 0,
    createdAt: Date.now()
  };

  state.events.unshift(event);

  saveState();
  renderAll();
}

function undoLastStat() {
  const currentEvents = getCurrentGameEvents();

  if (currentEvents.length === 0) {
    alert("No stats to undo.");
    return;
  }

  const lastEvent = currentEvents[0];

  state.events = state.events.filter(event => event.id !== lastEvent.id);

  saveState();
  renderAll();
}

function jumpToEvent(eventId) {
  const event = state.events.find(item => item.id === eventId);

  if (!event) return;

  if (!video.src) {
    alert("Load the video again first, then tap this play.");
    switchTab("film");
    return;
  }

  switchTab("film");

  video.currentTime = Math.max(0, event.timestamp - 4);
  video.play();
}

function saveTeamName() {
  const name = teamNameInput.value.trim();

  if (!name) {
    alert("Enter a team name.");
    return;
  }

  state.teamName = name;
  saveState();
  renderAll();
  alert("Team name saved.");
}

function resetApp() {
  if (!confirm("Reset VolleyVision? This clears roster, games, and stats from this browser.")) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);

  state = {
    teamName: "VolleyVision Team",
    players: [],
    games: [],
    events: [],
    currentGameId: null
  };

  selectedPlayerId = null;

  if (currentVideoObjectUrl) {
    URL.revokeObjectURL(currentVideoObjectUrl);
    currentVideoObjectUrl = null;
  }

  video.removeAttribute("src");
  video.load();

  saveState();
  renderAll();
  switchTab("home");
}

function buildTotalsForPlayer(playerId) {
  const totals = {};

  REPORT_STATS.forEach(stat => {
    totals[stat] = 0;
  });

  state.events
    .filter(event => event.playerId === playerId)
    .forEach(event => {
      totals[event.statType] = (totals[event.statType] || 0) + 1;
    });

  return totals;
}

function renderHome() {
  homePlayerCount.textContent = state.players.length;
  homeGameCount.textContent = state.games.length;
  homeStatCount.textContent = state.events.length;

  const totalKills = state.events.filter(event => event.statType === "KILL").length;
  homeKillCount.textContent = totalKills;
}

function renderRoster() {
  playerList.innerHTML = "";

  if (state.players.length === 0) {
    playerList.innerHTML = `<p class="small-note">No players yet. Add your roster above.</p>`;
    return;
  }

  state.players
    .slice()
    .sort((a, b) => Number(a.number) - Number(b.number))
    .forEach(player => {
      const row = document.createElement("div");
      row.className = "player-row";

      row.innerHTML = `
        <div>
          <div class="player-main">#${player.number} ${player.name}</div>
          <div class="player-sub">${player.position}</div>
        </div>

        <button class="delete-small" data-delete-player="${player.id}">Delete</button>
      `;

      playerList.appendChild(row);
    });

  document.querySelectorAll("[data-delete-player]").forEach(button => {
    button.addEventListener("click", () => {
      deletePlayer(button.dataset.deletePlayer);
    });
  });
}

function renderPlayerChips() {
  playerChips.innerHTML = "";

  if (state.players.length === 0) {
    playerChips.innerHTML = `<p class="small-note">Add players on the Roster tab first.</p>`;
    selectedPlayerText.textContent = "No player selected.";
    return;
  }

  state.players
    .slice()
    .sort((a, b) => Number(a.number) - Number(b.number))
    .forEach(player => {
      const button = document.createElement("button");
      button.className = "player-chip";
      button.textContent = `#${player.number} ${player.name}`;

      if (selectedPlayerId === player.id) {
        button.classList.add("active");
      }

      button.addEventListener("click", () => {
        selectedPlayerId = player.id;
        renderPlayerChips();
      });

      playerChips.appendChild(button);
    });

  const selectedPlayer = getPlayer(selectedPlayerId);

  selectedPlayerText.textContent = selectedPlayer
    ? `Selected: #${selectedPlayer.number} ${selectedPlayer.name}`
    : "No player selected.";
}

function renderEventLog() {
  const events = getCurrentGameEvents();
  eventLog.innerHTML = "";

  if (events.length === 0) {
    eventLog.innerHTML = `<p class="small-note">No stats tagged for this game yet.</p>`;
    return;
  }

  events.forEach(event => {
    const player = getPlayer(event.playerId);
    const row = document.createElement("div");
    row.className = "event-row";

    row.innerHTML = `
      <div class="event-left">
        <span class="event-time">${formatTime(event.timestamp)}</span>
        <span class="event-detail">#${player ? player.number : "?"} ${player ? player.name : "Unknown Player"}</span>
      </div>

      <span class="event-stat">${STAT_LABELS[event.statType] || event.statType}</span>
    `;

    row.addEventListener("click", () => jumpToEvent(event.id));
    eventLog.appendChild(row);
  });
}

function renderReports() {
  reportTableBody.innerHTML = "";

  if (state.players.length === 0) {
    reportTableBody.innerHTML = `
      <tr>
        <td colspan="11">No players added yet.</td>
      </tr>
    `;
  } else {
    state.players
      .slice()
      .sort((a, b) => Number(a.number) - Number(b.number))
      .forEach(player => {
        const totals = buildTotalsForPlayer(player.id);
        const blocks = (totals.SOLO_BLOCK || 0) + (totals.BLOCK_ASSIST || 0);

        const row = document.createElement("tr");

        row.innerHTML = `
          <td>#${player.number} ${player.name}</td>
          <td>${totals.ACE || 0}</td>
          <td>${totals.SERVE_ERROR || 0}</td>
          <td>${totals.RECEPTION || 0}</td>
          <td>${totals.RECEPTION_ERROR || 0}</td>
          <td>${totals.ASSIST || 0}</td>
          <td>${totals.KILL || 0}</td>
          <td>${totals.ATTACK_ERROR || 0}</td>
          <td>${totals.DIG || 0}</td>
          <td>${blocks}</td>
          <td>${totals.BLOCK_TOUCH || 0}</td>
        `;

        reportTableBody.appendChild(row);
      });
  }

  renderClipFinder();
}

function renderClipFinder() {
  clipFinderList.innerHTML = "";

  if (state.events.length === 0) {
    clipFinderList.innerHTML = `<p class="small-note">No clips yet. Tag plays during film review first.</p>`;
    return;
  }

  state.events
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(event => {
      const player = getPlayer(event.playerId);
      const game = state.games.find(item => item.id === event.gameId);

      const row = document.createElement("div");
      row.className = "event-row";

      row.innerHTML = `
        <div class="event-left">
          <span class="event-time">${formatTime(event.timestamp)}</span>
          <span class="event-detail">
            ${STAT_LABELS[event.statType] || event.statType}
            — #${player ? player.number : "?"} ${player ? player.name : "Unknown Player"}
          </span>
          <span class="player-sub">${game ? game.name : "Unknown game"}</span>
        </div>

        <span class="event-stat">Watch</span>
      `;

      row.addEventListener("click", () => jumpToEvent(event.id));
      clipFinderList.appendChild(row);
    });
}

function renderSettings() {
  teamNameInput.value = state.teamName || "VolleyVision Team";
}

function renderStatButtons() {
  const buttons = document.querySelectorAll("[data-stat]");

  buttons.forEach(button => {
    button.disabled = !selectedPlayerId || !state.currentGameId;
  });
}

function renderAll() {
  renderHome();
  renderRoster();
  renderPlayerChips();
  renderEventLog();
  renderReports();
  renderSettings();
  renderStatButtons();
  updateVideoTime();
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    switchTab(tab.dataset.tab);
  });
});

document.querySelectorAll("[data-jump]").forEach(button => {
  button.addEventListener("click", () => {
    switchTab(button.dataset.jump);
  });
});

addPlayerBtn.addEventListener("click", addPlayer);

videoInput.addEventListener("change", event => {
  loadVideoFile(event.target.files[0]);
});

document.getElementById("back10Btn").addEventListener("click", () => {
  video.currentTime = Math.max(0, video.currentTime - 10);
});

document.getElementById("back5Btn").addEventListener("click", () => {
  video.currentTime = Math.max(0, video.currentTime - 5);
});

document.getElementById("forward5Btn").addEventListener("click", () => {
  video.currentTime = video.currentTime + 5;
});

document.getElementById("forward10Btn").addEventListener("click", () => {
  video.currentTime = video.currentTime + 10;
});

document.getElementById("playPauseBtn").addEventListener("click", () => {
  if (video.paused) {
    video.play();
  } else {
    video.pause();
  }
});

document.querySelectorAll("[data-stat]").forEach(button => {
  button.addEventListener("click", () => {
    tagStat(button.dataset.stat);
  });
});

undoBtn.addEventListener("click", undoLastStat);
saveTeamNameBtn.addEventListener("click", saveTeamName);
resetBtn.addEventListener("click", resetApp);

video.addEventListener("timeupdate", updateVideoTime);
video.addEventListener("loadedmetadata", updateVideoTime);

loadState();
renderAll();
