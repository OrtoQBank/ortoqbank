'use server';

import ImageKit from 'imagekit';
import sharp from 'sharp';

const imageKit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

// Image optimization constants
export const IMAGE_OPTIMIZATION = {
  FORMAT: 'webp',
  QUALITY: 80, // 80% quality - good balance between size and quality
  MAX_WIDTH: 500, // 500px max width for content images
  MAX_FILE_SIZE_MB: 5, // Maximum file size before compression (in MB)
} as const;

export async function uploadToImageKit(file: File) {
  const fileSizeMB = file.size / (1024 * 1024);

  console.log('[ImageKit] Starting upload:', {
    fileName: file.name,
    fileType: file.type,
    fileSizeMB: fileSizeMB.toFixed(2),
  });

  // Validate file size before processing
  if (fileSizeMB > IMAGE_OPTIMIZATION.MAX_FILE_SIZE_MB) {
    const errorMsg = `Arquivo muito grande: ${fileSizeMB.toFixed(2)}MB. Máximo permitido: ${IMAGE_OPTIMIZATION.MAX_FILE_SIZE_MB}MB`;
    console.error('[ImageKit] File too large:', {
      fileName: file.name,
      fileSizeMB: fileSizeMB.toFixed(2),
      maxSizeMB: IMAGE_OPTIMIZATION.MAX_FILE_SIZE_MB,
    });
    throw new Error(errorMsg);
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    console.log('[ImageKit] ArrayBuffer created, starting sharp optimization...');

    // Optimize image before upload
    const optimizedBuffer = await sharp(Buffer.from(arrayBuffer))
      .webp({ quality: IMAGE_OPTIMIZATION.QUALITY })
      .resize(IMAGE_OPTIMIZATION.MAX_WIDTH, undefined, {
        withoutEnlargement: true,
      })
      .toBuffer();

    const optimizedSizeKB = optimizedBuffer.length / 1024;
    console.log('[ImageKit] Image optimized:', {
      originalSizeMB: fileSizeMB.toFixed(2),
      optimizedSizeKB: optimizedSizeKB.toFixed(2),
      compressionRatio: `${((1 - optimizedBuffer.length / file.size) * 100).toFixed(1)}%`,
    });

    const response = await imageKit.upload({
      file: optimizedBuffer,
      fileName: `${file.name.split('.')[0]}.${IMAGE_OPTIMIZATION.FORMAT}`,
      useUniqueFileName: true,
    });

    console.log('[ImageKit] Upload successful:', {
      fileName: file.name,
      url: response.url,
    });

    return response.url;
  } catch (error) {
    console.error('[ImageKit] Upload failed:', {
      fileName: file.name,
      fileSizeMB: fileSizeMB.toFixed(2),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Server-side proxy function to fetch external images
export async function fetchExternalImage(url: string) {
  try {
    // Fetch the image server-side (no CORS issues here)
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch image: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Optimize the image
    const optimizedBuffer = await sharp(buffer)
      .webp({ quality: IMAGE_OPTIMIZATION.QUALITY })
      .resize(IMAGE_OPTIMIZATION.MAX_WIDTH, undefined, {
        withoutEnlargement: true,
      })
      .toBuffer();

    // Upload directly to ImageKit
    const filename = url.split('/').pop() || 'external-image.jpg';
    const response2 = await imageKit.upload({
      file: optimizedBuffer,
      fileName: `${filename.split('.')[0]}.${IMAGE_OPTIMIZATION.FORMAT}`,
      useUniqueFileName: true,
    });

    // Return the ImageKit URL
    return response2.url;
  } catch (error) {
    console.error('External image fetch failed:', error);
    throw error;
  }
}
