// Re-encode a centred crop before upload; keep original files out of the database.
export async function prepareAvatar(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Chọn ảnh JPG, PNG hoặc WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh tải lên tối đa 5 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error('Không đọc được ảnh này. Vui lòng chọn ảnh khác.'); });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context || !image.naturalWidth || !image.naturalHeight) throw new Error('Không thể xử lý ảnh.');
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    const result = canvas.toDataURL('image/webp', 0.85);
    if (result.length > 350_000) throw new Error('Ảnh sau khi xử lý quá lớn. Vui lòng chọn ảnh khác.');
    return result;
  } finally { URL.revokeObjectURL(url); }
}
