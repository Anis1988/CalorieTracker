/**
 * Photos are made smaller on the phone before anything is sent: a 1280px copy for the AI (plenty to see portions,
 * quick to upload) and a 360px copy to keep with the meal. The original never leaves the phone.
 */
export async function shrink(file: Blob, max: number, quality = 0.82): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(() => null);
  const src: CanvasImageSource & { width: number; height: number } = bmp ?? (await loadImg(file));
  const r = Math.min(1, max / Math.max(src.width, src.height));
  const w = Math.round(src.width * r), h = Math.round(src.height * r);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.drawImage(src, 0, 0, w, h);
  bmp?.close();
  return c.toDataURL('image/jpeg', quality);
}

function loadImg(file: Blob): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); ok(img); };
    img.onerror = () => fail(new Error('That picture couldn’t be opened.'));
    img.src = URL.createObjectURL(file);
  });
}

export const forAi = (f: Blob) => shrink(f, 1280, 0.82);
export const thumb = async (f: Blob | string) => shrink(typeof f === "string" ? await fromDataUrl(f) : f, 360, 0.72);
const fromDataUrl = async (s: string) => (await fetch(s)).blob();
