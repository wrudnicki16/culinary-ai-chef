import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with credentials from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Always use HTTPS
});

/**
 * Upload an image from a URL to Cloudinary
 * This is used to permanently store DALL-E generated images
 *
 * @param imageUrl - The temporary URL from DALL-E or other source
 * @param options - Optional upload configuration
 * @returns The permanent Cloudinary URL
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  options?: {
    folder?: string;
    publicId?: string;
  }
): Promise<string> {
  try {
    // Validate environment variables
    if (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary credentials are not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment variables.');
    }

    // Upload image to Cloudinary
    // Cloudinary can fetch the image directly from the URL
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: options?.folder || 'recipe-images', // Organize images in a folder
      public_id: options?.publicId, // Optional: specify a custom ID
      resource_type: 'image',
      overwrite: false, // Don't overwrite existing images
      unique_filename: true, // Generate unique filenames
    });

    // Return the secure (HTTPS) URL
    return result.secure_url;
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error);
    throw new Error(`Failed to upload image to Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete an image from Cloudinary
 *
 * @param publicId - The Cloudinary public ID of the image to delete
 * @returns True if deletion was successful
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    return false;
  }
}

/**
 * Extract the public ID from a Cloudinary URL
 * Useful for deleting images later
 *
 * @param cloudinaryUrl - The full Cloudinary URL
 * @returns The public ID (including folder path)
 */
export function extractPublicId(cloudinaryUrl: string): string | null {
  try {
    // Example URL: https://res.cloudinary.com/demo/image/upload/v1234567890/recipe-images/abc123.jpg
    const urlParts = cloudinaryUrl.split('/');
    const uploadIndex = urlParts.indexOf('upload');

    if (uploadIndex === -1) return null;

    // Get everything after 'upload/v1234567890/' (version is optional)
    const pathAfterUpload = urlParts.slice(uploadIndex + 1);

    // Skip version if present (starts with 'v' followed by numbers)
    const startIndex = pathAfterUpload[0].match(/^v\d+$/) ? 1 : 0;

    // Join the rest and remove file extension
    const publicIdWithExtension = pathAfterUpload.slice(startIndex).join('/');
    const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, '');

    return publicId;
  } catch (error) {
    console.error('Error extracting public ID from URL:', error);
    return null;
  }
}

/**
 * Get an optimized URL for an image with transformations
 *
 * @param publicId - The Cloudinary public ID
 * @param width - Desired width
 * @param height - Desired height
 * @returns Optimized image URL
 */
export function getOptimizedImageUrl(
  publicId: string,
  width?: number,
  height?: number
): string {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto', // Automatically choose best format (WebP, AVIF, etc.)
  });
}
