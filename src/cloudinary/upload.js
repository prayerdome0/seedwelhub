// Cloudinary media uploads.
//
// Cloudinary currently has NO folders — do not create or require folders. We
// use the existing UNSIGNED "seedwel" upload preset directly with the
// application's cloud name. Because the preset is unsigned, media can be
// uploaded straight to the client without exposing a private API secret.

// Public Cloudinary configuration (safe to ship to the browser).
export const CLOUDINARY_CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'nqyylkmd';
export const CLOUDINARY_UPLOAD_PRESET =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'seedwel';

export const UPLOAD_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024; // 80 MB

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
];

export function isImageFile(file) {
  return file && ACCEPTED_IMAGE_TYPES.includes(file.type);
}

export function isVideoFile(file) {
  return file && /^video\//.test(file.type);
}

export function validateUploadFile(file) {
  if (!file) {
    throw new Error('Please choose a file to upload.');
  }
  if (isImageFile(file)) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error('That image is too large. Please choose an image under 10 MB.');
    }
    return 'image';
  }
  if (isVideoFile(file)) {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error('That video is too large. Please choose a smaller video.');
    }
    return 'video';
  }
  throw new Error('This file type is not supported. Please choose an image or video.');
}

/**
 * Uploads a file to Cloudinary and returns the secure URL.
 * Uses the built-in unsigned preset via a simple FormData POST — no SDK, no
 * private key, no folder.
 */
export async function uploadToCloudinary(file, options = {}) {
  const resourceType = options.resourceType || validateUploadFile(file);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  if (options.publicId) formData.append('public_id', options.publicId);

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let message = 'Upload failed. Please try again.';
    try {
      const data = await response.json();
      if (data && data.message) message = data.message;
    } catch (e) {
      // ignore parse errors
    }
    throw new Error(message);
  }

  const data = await response.json();

  const url = data.secure_url || data.url;
  if (!url) {
    throw new Error('Upload completed but no URL was returned. Please try again.');
  }

  return {
    url,
    secureUrl: data.secure_url,
    publicId: data.public_id,
    resourceType,
    bytes: data.bytes,
    format: data.format,
  };
}

// Convenience wrapper for images.
export function uploadImageToCloudinary(file, options = {}) {
  return uploadToCloudinary(file, { ...options, resourceType: 'image' });
}

// Convenience wrapper for videos.
export function uploadVideoToCloudinary(file, options = {}) {
  return uploadToCloudinary(file, { ...options, resourceType: 'video' });
}
