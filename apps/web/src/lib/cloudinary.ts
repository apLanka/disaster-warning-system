const UPLOAD_SEGMENT = '/upload/';

/**
 * Cloudinary resizes on the fly when a transformation is added to the URL, so
 * the table and thumbnails fetch a small image instead of the full photo.
 * Any other URL is returned untouched.
 */
export function thumbnailUrl(
  secureUrl: string,
  width = 160,
  height = 120,
): string {
  const index = secureUrl.indexOf(UPLOAD_SEGMENT);
  if (index === -1) return secureUrl;

  const split = index + UPLOAD_SEGMENT.length;
  return `${secureUrl.slice(0, split)}c_fill,w_${width},h_${height}/${secureUrl.slice(split)}`;
}
