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
  if (await isAnimatedImage(sourceBlob)) {
    throw new Error("Похоже, это анимированное изображение. Чтобы не потерять анимацию, выберите оригинальный формат.");
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

async function isAnimatedImage(blob) {
  if (blob.type === "image/gif") return true;
  const bytes = new Uint8Array(await blob.slice(0, Math.min(blob.size, 2 * 1024 * 1024)).arrayBuffer());
  const hasMarker = marker => {
    const markerBytes = new TextEncoder().encode(marker);
    outer: for (let i = 0; i <= bytes.length - markerBytes.length; i++) {
      for (let j = 0; j < markerBytes.length; j++) {
        if (bytes[i + j] !== markerBytes[j]) continue outer;
      }
      return true;
    }
    return false;
  };
  if (blob.type === "image/png" && hasMarker("acTL")) return true;
  if (blob.type === "image/webp" && (hasMarker("ANIM") || hasMarker("ANMF"))) return true;
  if (blob.type === "image/avif" && hasMarker("avis")) return true;
  return false;
}
