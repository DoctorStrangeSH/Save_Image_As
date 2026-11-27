const cards = [...document.querySelectorAll(".format-card")];
const quality = document.getElementById("quality");
const qualityValue = document.getElementById("qualityValue");
const savedState = document.getElementById("savedState");
let currentFormat = "webp";

async function loadSettings() {
  const settings = await chrome.storage.sync.get({ format: "webp", quality: 90 });
  currentFormat = ["png", "jpg", "webp"].includes(settings.format) ? settings.format : "webp";
  quality.value = settings.quality;
  qualityValue.textContent = `${settings.quality}%`;
  updateCards();
}

function updateCards() {
  cards.forEach(card => card.classList.toggle("selected", card.dataset.format === currentFormat));
}

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