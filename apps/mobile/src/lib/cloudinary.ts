const UPLOAD_SEGMENT = '/upload/';

/** Cloudinary resizes on the fly when a transformation is added to the URL. */
export function thumbnailUrl(
  secureUrl: string,
  width = 400,
  height = 300,
): string {
  const index = secureUrl.indexOf(UPLOAD_SEGMENT);
  if (index === -1) return secureUrl;
  const split = index + UPLOAD_SEGMENT.length;
  return `${secureUrl.slice(0, split)}c_fill,w_${width},h_${height}/${secureUrl.slice(split)}`;
}
