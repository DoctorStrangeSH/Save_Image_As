const cards = [...document.querySelectorAll(".format-card")];
const quality = document.getElementById("quality");
const qualityValue = document.getElementById("qualityValue");
const savedState = document.getElementById("savedState");
const operationStatus = document.getElementById("operationStatus");
let currentFormat = "webp";

async function loadSettings() {
  const [settings, local] = await Promise.all([
    chrome.storage.sync.get({ format: "webp", quality: 90 }),
    chrome.storage.local.get({ lastOperation: null })
  ]);
  currentFormat = ["png", "jpg", "webp"].includes(settings.format) ? settings.format : "webp";
  quality.value = settings.quality;
  qualityValue.textContent = `${settings.quality}%`;
  updateCards();
  renderOperationStatus(local.lastOperation);
}

function updateCards() {
  cards.forEach(card => card.classList.toggle("selected", card.dataset.format === currentFormat));
}

function renderOperationStatus(operation) {
  if (!operation?.message) {
    operationStatus.hidden = true;
    operationStatus.textContent = "";
    return;
  }
  operationStatus.hidden = false;
  operationStatus.className = `operation-status ${["error", "pending"].includes(operation.type) ? operation.type : "success"}`;
  operationStatus.textContent = operation.message;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.lastOperation) renderOperationStatus(changes.lastOperation.newValue);
});

async function saveSettings() {
  const value = Number(quality.value);
  await chrome.storage.sync.set({ format: currentFormat, quality: value });
  savedState.textContent = "✓ Настройки сохранены";
}

cards.forEach(card => card.addEventListener("click", async () => {
  currentFormat = card.dataset.format;
  updateCards();
  await saveSettings();
}));

quality.addEventListener("input", () => {
  qualityValue.textContent = `${quality.value}%`;
});
quality.addEventListener("change", saveSettings);

loadSettings().catch(error => {
  console.error(error);
  savedState.textContent = "Не удалось загрузить настройки";
});