const MAX_API_IMAGE_SIZE = 1536;
const API_IMAGE_QUALITY = 0.8;

export function compressBase64ForApi(
  base64Data: string,
  mimeType: string,
): Promise<{ base64Data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_API_IMAGE_SIZE / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', API_IMAGE_QUALITY);
      resolve({
        base64Data: compressed.split(',')[1],
        mimeType: 'image/jpeg',
      });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
