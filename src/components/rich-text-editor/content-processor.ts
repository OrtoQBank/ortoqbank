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
 * Recursively validates that all image sources within the content start with the specified ImageKit endpoint.
 */
export const validateImageSources = (
  content: TiptapNode[],
  imageKitEndpoint: string,
): boolean => {
  for (const node of content) {
    if (
      isImageNode(node.type) && // Check if src exists and starts with the ImageKit endpoint
      (!node.attrs?.src || !node.attrs.src.startsWith(imageKitEndpoint))
    ) {
      console.warn('Invalid image source found:', node.attrs?.src);
      return false; // Invalid source found
    }
    // Recursively check content if the node has children
    if (
      node.content &&
      Array.isArray(node.content) &&
      !validateImageSources(node.content, imageKitEndpoint)
    ) {
      return false; // Invalid source found in children
    }
  }
  return true; // All image sources are valid
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

      if (pendingUpload) {
        try {
          const imagekitUrl = await uploadToImageKit(pendingUpload.file);
          // Update the cloned node's attributes and strip null values
          processedNode.attrs = stripNullValues({
            ...processedNode.attrs,
            src: imagekitUrl,
          });
          // Clean up
          URL.revokeObjectURL(blobUrl);
          pendingUploads.delete(blobUrl);
        } catch (error) {
          console.error('Failed to upload image:', error);
          // Keep original node attrs (with blob URL) - validation will catch this later
        }
      } else {
        console.warn('Blob URL found without pending upload:', blobUrl);
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
