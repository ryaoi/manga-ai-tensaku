interface ImageDimensions {
  width: number;
  height: number;
}

function buildCleanupPrompt(dims: ImageDimensions, conservative: boolean): string {
  const strictness = conservative
    ? '最重要: 元の線画・トーン・陰影・背景の細部は絶対に変更しないでください。添削インクの除去だけ行ってください。'
    : '元の線画や構図を保ちつつ、添削インクのみを消してください。';

  return `あなたは画像修復の専門家です。
漫画の添削済み画像から「添削インク」だけを除去してください。
画像サイズは ${dims.width}x${dims.height} です。

【除去対象】
- 赤い線、赤い文字、赤い記号
- 青い線、青い文字、青い記号
- 添削の矢印、囲み、メモ、マーク

【保持対象】
- 元の鉛筆線、ペン線、トーン、陰影、輪郭、表情、髪、服、背景
- 紙の質感やモノクロ情報

【厳守事項】
- 新しく絵を描き足さない
- 絵柄や構図を変えない
- 顔・目・口・髪型などの元絵を再解釈しない
- 添削インク以外は可能な限りそのまま残す
- 出力のアスペクト比と解像度を入力と一致させる
- 文字は新規に書き込まない
- 返すのは編集後画像のみ

${strictness}`;
}

export function getImageDimensions(dataUrl: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function resizeImageToMatch(sourceDataUrl: string, targetDims: ImageDimensions): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetDims.width;
      canvas.height = targetDims.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context while resizing'));
        return;
      }
      ctx.drawImage(img, 0, 0, targetDims.width, targetDims.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = sourceDataUrl;
  });
}

async function generateCleanupImage(base64Data: string, mimeType: string, dims: ImageDimensions, conservative: boolean): Promise<string | null> {
  const prompt = buildCleanupPrompt(dims, conservative);

  const response = await fetch('/api/generate-cleanup-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, mimeType, prompt }),
  });

  if (!response.ok) throw new Error('Cleanup image API failed');
  const data = await response.json();

  if (data.imageData) {
    return `data:${data.mimeType || 'image/png'};base64,${data.imageData}`;
  }

  return null;
}

function compareDifferenceRatio(originalDataUrl: string, cleanedDataUrl: string, dims: ImageDimensions): Promise<number> {
  return new Promise((resolve, reject) => {
    const originalImg = new Image();
    const cleanedImg = new Image();
    let loaded = 0;

    const onLoad = () => {
      loaded += 1;
      if (loaded < 2) return;

      const canvas = document.createElement('canvas');
      canvas.width = dims.width;
      canvas.height = dims.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context while comparing images'));
        return;
      }

      ctx.drawImage(originalImg, 0, 0, dims.width, dims.height);
      const original = ctx.getImageData(0, 0, dims.width, dims.height).data;
      ctx.clearRect(0, 0, dims.width, dims.height);
      ctx.drawImage(cleanedImg, 0, 0, dims.width, dims.height);
      const cleaned = ctx.getImageData(0, 0, dims.width, dims.height).data;

      let changedPixels = 0;
      const totalPixels = dims.width * dims.height;
      for (let i = 0; i < original.length; i += 4) {
        const dr = Math.abs(original[i] - cleaned[i]);
        const dg = Math.abs(original[i + 1] - cleaned[i + 1]);
        const db = Math.abs(original[i + 2] - cleaned[i + 2]);
        if (dr + dg + db > 95) {
          changedPixels += 1;
        }
      }
      resolve(changedPixels / totalPixels);
    };

    originalImg.onload = onLoad;
    cleanedImg.onload = onLoad;
    originalImg.onerror = reject;
    cleanedImg.onerror = reject;
    originalImg.src = originalDataUrl;
    cleanedImg.src = cleanedDataUrl;
  });
}

export async function removeTensakuMarks(inputDataUrl: string, mimeType: string): Promise<string> {
  const dims = await getImageDimensions(inputDataUrl);
  const base64Data = inputDataUrl.split(',')[1];
  if (!base64Data) {
    throw new Error('Invalid image data');
  }

  let cleaned = await generateCleanupImage(base64Data, mimeType, dims, false);
  if (!cleaned) {
    throw new Error('AI did not return a cleaned image');
  }

  const cleanedDims = await getImageDimensions(cleaned);
  if (cleanedDims.width !== dims.width || cleanedDims.height !== dims.height) {
    cleaned = await resizeImageToMatch(cleaned, dims);
  }

  const diffRatio = await compareDifferenceRatio(inputDataUrl, cleaned, dims);
  if (diffRatio > 0.38) {
    const conservative = await generateCleanupImage(base64Data, mimeType, dims, true);
    if (conservative) {
      const conservativeDims = await getImageDimensions(conservative);
      cleaned = (conservativeDims.width !== dims.width || conservativeDims.height !== dims.height)
        ? await resizeImageToMatch(conservative, dims)
        : conservative;
    }
  }

  return cleaned;
}
