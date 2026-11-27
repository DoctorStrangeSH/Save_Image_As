const MENU = {
  original: "save-original",
  png: "save-png",
  jpg: "save-jpg",
  webp: "save-webp",
  default: "save-default"
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(["format", "quality"]);
  await chrome.storage.sync.set({
    format: current.format || "webp",
    quality: current.quality ?? 90
  });

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-image-as",
      title: "Сохранить изображение как…",
      contexts: ["image"]
    });
    chrome.contextMenus.create({
      id: MENU.default,
      parentId: "save-image-as",
      title: "Сохранить в выбранном формате",
      contexts: ["image"]
    });
    chrome.contextMenus.create({
      id: MENU.original,
      parentId: "save-image-as",
      title: "Оригинальный формат",
      contexts: ["image"]
    });
    chrome.contextMenus.create({
      id: MENU.png,
      parentId: "save-image-as",
      title: "PNG",
      contexts: ["image"]
    });
    chrome.contextMenus.create({
      id: MENU.jpg,
      parentId: "save-image-as",
      title: "JPG",
      contexts: ["image"]
    });
    chrome.contextMenus.create({
      id: MENU.webp,
      parentId: "save-image-as",
      title: "WebP",
      contexts: ["image"]
    });
    updateDefaultMenu();
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.format) updateDefaultMenu();
});

async function updateDefaultMenu() {
  const { format = "webp" } = await chrome.storage.sync.get({ format: "webp" });
  const label = format.toUpperCase();
  chrome.contextMenus.update(MENU.default, {
    title: `Сохранить в ${label} (по умолчанию)`
  }, () => void chrome.runtime.lastError);
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (!info.srcUrl) return;
  let format = Object.keys(MENU).find(key => MENU[key] === info.menuItemId);
  if (!format) return;
  if (format === "default") {
    const settings = await chrome.storage.sync.get({ format: "webp" });
    format = settings.format;
  }

  try {
    if (format === "original") {
      await downloadOriginal(info.srcUrl);
      await chrome.action.setBadgeText({ text: "" });
      return;
    }
    const settings = await chrome.storage.sync.get({ quality: 90 });
    await convertAndDownload(info.srcUrl, format, settings.quality);
    await chrome.action.setBadgeText({ text: "" });
  } catch (error) {
    console.error("Save Image As:", error);
    await chrome.action.setBadgeBackgroundColor({ color: "#d94b4b" });
    await chrome.action.setBadgeText({ text: "!" });
  }
});

async function downloadOriginal(url) {
  const filename = makeFilename(url, extensionFromUrl(url) || "img");
  await chrome.downloads.download({ url, filename, conflictAction: "uniquify" });
}

async function convertAndDownload(url, format, quality) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({
    target: "offscreen",
    type: "CONVERT_IMAGE",
    url,
    format,
    quality: Math.max(10, Math.min(100, Number(quality) || 90)) / 100
  });

  if (!response?.ok) throw new Error(response?.error || "Конвертация не удалась.");
  const filename = makeFilename(url, format === "jpg" ? "jpg" : format);
  await chrome.downloads.download({
    url: response.objectUrl,
    filename,
    saveAs: false,
    conflictAction: "uniquify"
  });
}

async function ensureOffscreenDocument() {
  const path = "offscreen.html";
  const url = chrome.runtime.getURL(path);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url]
  });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({
    url: path,
    reasons: ["BLOBS"],
    justification: "Загрузка изображения и преобразование его в выбранный формат."
  });
}

function extensionFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    return path.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  } catch {
    return "";
  }
}

function makeFilename(url, ext) {
  let name = "image";
  try {
    const segment = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (segment) name = decodeURIComponent(segment).replace(/\.[^.]+$/, "");
  } catch {}
  name = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 100) || "image";
  return `${name}.${ext}`;
}