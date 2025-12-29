'use server';

import ImageKit from 'imagekit';
import sharp from 'sharp';

import { IMAGE_OPTIMIZATION } from './constants';

const imageKit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

/**
 * Upload image to ImageKit using FormData (native Server Action file support).
 */
export async function uploadToImageKit(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) {
    throw new Error('No file provided');
  }

  const fileSizeMB = file.size / (1024 * 1024);

  console.log('[ImageKit] Starting upload:', {
    fileName: file.name,
    fileType: file.type,
    fileSizeMB: fileSizeMB.toFixed(2),
  });

  // Validate file size
  if (fileSizeMB > IMAGE_OPTIMIZATION.MAX_FILE_SIZE_MB) {
    throw new Error(
      `Arquivo muito grande: ${fileSizeMB.toFixed(2)}MB. Máximo: ${IMAGE_OPTIMIZATION.MAX_FILE_SIZE_MB}MB`,
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Optimize image
    const optimizedBuffer = await sharp(buffer)
      .webp({ quality: IMAGE_OPTIMIZATION.QUALITY })
      .resize(IMAGE_OPTIMIZATION.MAX_WIDTH, undefined, {
        withoutEnlargement: true,
      })
      .toBuffer();

    console.log('[ImageKit] Image optimized:', {
      originalKB: (file.size / 1024).toFixed(2),
      optimizedKB: (optimizedBuffer.length / 1024).toFixed(2),
    });

    const response = await imageKit.upload({
      file: optimizedBuffer,
      fileName: `${file.name.split('.')[0]}.${IMAGE_OPTIMIZATION.FORMAT}`,
      useUniqueFileName: true,
    });

    console.log('[ImageKit] Upload successful:', response.url);
    return response.url;
  } catch (error) {
    console.error('[ImageKit] Upload failed:', error);
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
