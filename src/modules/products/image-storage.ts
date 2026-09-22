export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif'
] as const;

export type AcceptedImageMimeType = (typeof ACCEPTED_IMAGE_MIME_TYPES)[number];

export interface ImageUpload {
  bytes: Uint8Array;
  mimeType: AcceptedImageMimeType;
  fileName: string;
}

export interface ImageStorage {
  putProductImage(productId: string, image: ImageUpload): Promise<{ url: string }>;
  deleteByUrl(url: string): Promise<void>;
}
