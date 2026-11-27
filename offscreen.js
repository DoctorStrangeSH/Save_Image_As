chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "offscreen") return;
  if (message.type === "REVOKE_URL") {
    URL.revokeObjectURL(message.objectUrl);
    return;
  }
  if (message.type !== "CONVERT_IMAGE") return;
  convertImage(message.url, message.format, message.quality)
    .then(objectUrl => sendResponse({ ok: true, objectUrl }))
    .catch(error => sendResponse({ ok: false, error: error.message || "Ошибка конвертации." }));
  return true;
});

async function convertImage(url, format, quality) {
  const response = await fetch(url, { credentials: "omit", cache: "no-store" });
  if (!response.ok) throw new Error(`Сайт вернул ошибку HTTP ${response.status}.`);
  const sourceBlob = await response.blob();
  if (!sourceBlob.type.startsWith("image/")) {
    throw new Error("По этой ссылке находится не изображение.");
  }
  if (sourceBlob.type === "image/svg+xml" || /\.svg(?:$|[?#])/i.test(url)) {
    throw new Error("SVG — векторный формат. Для него выберите «Оригинальный формат».");
  }
  if (sourceBlob.type === "image/gif") {
    throw new Error("GIF может быть анимированным. Чтобы сохранить анимацию, выберите оригинальный формат.");
  }

  const bitmap = await createImageBitmap(sourceBlob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось создать холст для конвертации.");

    if (format === "jpg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0);

    const mime = format === "jpg" ? "image/jpeg" : `image/${format}`;
    const blob = await canvas.convertToBlob({
      type: mime,
      quality: format === "png" ? undefined : quality
    });
    if (blob.type !== mime) {
      throw new Error(`Браузер не поддерживает экспорт в ${format.toUpperCase()}.`);
    }
    return URL.createObjectURL(blob);
  } finally {
    bitmap.close();
  }
}