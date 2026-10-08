export type PickedImage = { data: string; media_type: string; preview: string; name: string };

/** Phone photos are huge: shrink to max 1600px JPEG before sending. PDFs pass through. */
export async function prepareImage(file: File): Promise<PickedImage> {
  const readAsDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('Could not read the file.'));
      r.readAsDataURL(blob);
    });

  if (file.type === 'application/pdf') {
    if (file.size > 5_000_000) throw new Error('That PDF is too large (max 5 MB).');
    const url = await readAsDataUrl(file);
    return { data: url.split(',')[1], media_type: 'application/pdf', preview: '', name: file.name };
  }
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo, screenshot or PDF.');

  const url = await readAsDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Couldn't open that image. Try a screenshot instead."));
    el.src = url;
  });
  const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const jpeg = canvas.toDataURL('image/jpeg', 0.85);
  return { data: jpeg.split(',')[1], media_type: 'image/jpeg', preview: jpeg, name: file.name || 'image' };
}
