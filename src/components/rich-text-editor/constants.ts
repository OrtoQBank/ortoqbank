// Image optimization constants - shared between client and server
export const IMAGE_OPTIMIZATION = {
  FORMAT: 'webp',
  QUALITY: 80, // 80% quality - good balance between size and quality
  MAX_WIDTH: 500, // 500px max width for content images
  MAX_FILE_SIZE_MB: 5, // Maximum file size before compression (in MB)
} as const;
