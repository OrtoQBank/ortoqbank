// src/components/rich-text-editor/content-processor.ts
import { pendingUploads } from './image-upload-button';
import { uploadToImageKit } from './upload-action';

// Define a basic type for Tiptap nodes (adjust if you have more specific types)
export interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  text?: string; // Added for text nodes
  // Add other potential node properties if needed
}

// Image node types to check - includes both standard image and resize extension types
const IMAGE_NODE_TYPES = ['image', 'imageResize'];

/**
 * Checks if a node type represents an image node.
 */
const isImageNode = (type: string): boolean => IMAGE_NODE_TYPES.includes(type);

/**
 * Removes null and undefined values from an object.
 * Returns a new object with only defined, non-null values.
 */
const stripNullValues = <T extends Record<string, unknown>>(
  obj: T,
): Partial<T> => {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
};

/**
 * Checks if any node in the content array represents an image with a blob URL.
 */
export const hasBlobUrls = (content: TiptapNode[]): boolean => {
  for (const node of content) {
    if (isImageNode(node.type) && node.attrs?.src?.startsWith('blob:')) {
      return true;
    }
    // Recursively check content if the node has children
    if (
      node.content &&
      Array.isArray(node.content) &&
      hasBlobUrls(node.content)
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Details about an invalid image source found during validation.
 */
export interface InvalidImageInfo {
  src: string | undefined;
  alt: string | undefined;
  reason: 'missing_src' | 'blob_url' | 'external_url' | 'invalid_format';
  nodeType: string;
}

/**
 * Recursively validates that all image sources within the content start with the specified ImageKit endpoint.
 * Returns an object with validation result and details about any invalid images.
 */
export const validateImageSourcesWithDetails = (
  content: TiptapNode[],
  imageKitEndpoint: string,
): { isValid: boolean; invalidImages: InvalidImageInfo[] } => {
  const invalidImages: InvalidImageInfo[] = [];

  const validate = (nodes: TiptapNode[]): void => {
    for (const node of nodes) {
      if (isImageNode(node.type)) {
        const src = node.attrs?.src;
        const alt = node.attrs?.alt;

        if (!src) {
          invalidImages.push({
            src,
            alt,
            reason: 'missing_src',
            nodeType: node.type,
          });
          console.error('[ImageValidation] Image missing src attribute:', {
            nodeType: node.type,
            attrs: node.attrs,
          });
        } else if (src.startsWith('blob:')) {
          invalidImages.push({
            src,
            alt,
            reason: 'blob_url',
            nodeType: node.type,
          });
          console.error('[ImageValidation] Image still has blob URL (upload may have failed):', {
            src,
            alt,
            nodeType: node.type,
            pendingUploadsSize: pendingUploads.size,
            hasPendingUpload: pendingUploads.has(src),
          });
        } else if (!src.startsWith(imageKitEndpoint)) {
          invalidImages.push({
            src,
            alt,
            reason: 'external_url',
            nodeType: node.type,
          });
          console.error('[ImageValidation] Image has external/invalid URL:', {
            src,
            alt,
            expectedPrefix: imageKitEndpoint,
            nodeType: node.type,
          });
        }
      }

      // Recursively check content if the node has children
      if (node.content && Array.isArray(node.content)) {
        validate(node.content);
      }
    }
  };

  validate(content);

  return {
    isValid: invalidImages.length === 0,
    invalidImages,
  };
};

/**
 * Recursively validates that all image sources within the content start with the specified ImageKit endpoint.
 * @deprecated Use validateImageSourcesWithDetails for better error reporting
 */
export const validateImageSources = (
  content: TiptapNode[],
  imageKitEndpoint: string,
): boolean => {
  const result = validateImageSourcesWithDetails(content, imageKitEndpoint);
  return result.isValid;
};

/**
 * Processes Tiptap content: uploads blob images to ImageKit, updates their URLs,
 * and strips null/undefined values from node attributes to keep the stored JSON clean.
 * Returns a new content array with updated image URLs and sanitized attributes.
 */
export const processEditorContent = async (
  content: TiptapNode[],
): Promise<TiptapNode[]> => {
  const processedNodes: TiptapNode[] = [];

  for (const node of content) {
    // Clone the node to avoid modifying the original data directly
    let processedNode = { ...node };

    // Strip null values from attrs if they exist
    if (processedNode.attrs) {
      processedNode.attrs = stripNullValues(processedNode.attrs);
    }

    if (isImageNode(node.type) && node.attrs?.src?.startsWith('blob:')) {
      const blobUrl = node.attrs.src;
      const pendingUpload = pendingUploads.get(blobUrl);

      console.log('[ImageUpload] Processing blob image:', {
        blobUrl: blobUrl.slice(0, 50) + '...',
        alt: node.attrs?.alt,
        hasPendingUpload: !!pendingUpload,
        pendingUploadsSize: pendingUploads.size,
        fileSize: pendingUpload?.file?.size,
        fileType: pendingUpload?.file?.type,
        fileName: pendingUpload?.file?.name,
      });

      if (pendingUpload) {
        try {
          const { file } = pendingUpload;
          console.log('[ImageUpload] Starting upload...', {
            fileName: file.name,
            fileSize: `${(file.size / 1024).toFixed(2)} KB`,
          });

          // Use FormData for native Server Action file support
          const formData = new FormData();
          formData.append('file', file);

          const imagekitUrl = await uploadToImageKit(formData);

          console.log('[ImageUpload] Upload successful:', imagekitUrl);

          // Update the cloned node's attributes and strip null values
          processedNode.attrs = stripNullValues({
            ...processedNode.attrs,
            src: imagekitUrl,
          });
          // Clean up
          URL.revokeObjectURL(blobUrl);
          pendingUploads.delete(blobUrl);
        } catch (error) {
          console.error('[ImageUpload] Failed:', error);
          // Keep original node attrs (with blob URL) - validation will catch this later
        }
      } else {
        console.error('[ImageUpload] Blob URL not found in pendingUploads map:', {
          blobUrl: blobUrl.slice(0, 80),
          alt: node.attrs?.alt,
          pendingUploadsKeys: [...pendingUploads.keys()].map(k => k.slice(0, 50)),
          hint: 'This can happen if: 1) Image was copy-pasted from another source, 2) Page was refreshed, 3) Image was added via drag-drop without proper handling',
        });
        // Keep original node attrs - validation will catch this later
      }
    }

    // Recursively process content if node has children
    if (node.content && Array.isArray(node.content)) {
      // Ensure attributes are carried over if they exist
      processedNode = {
        ...processedNode,
        content: await processEditorContent(node.content), // Recursive call
      };
    }

    processedNodes.push(processedNode); // Add the processed node
  }

  return processedNodes; // Return the array of processed nodes
};
