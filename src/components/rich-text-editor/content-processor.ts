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

/**
 * Checks if any node in the content array represents an image with a blob URL.
 */
export const hasBlobUrls = (content: TiptapNode[]): boolean => {
  for (const node of content) {
    if (node.type === 'image' && node.attrs?.src?.startsWith('blob:')) {
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
      node.type === 'image' && // Check if src exists and starts with the ImageKit endpoint
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
 * Processes Tiptap content: uploads blob images to ImageKit and updates their URLs.
 * Returns a new content array with updated image URLs.
 */
export const processEditorContent = async (
  content: TiptapNode[],
): Promise<TiptapNode[]> => {
  const processedNodes: TiptapNode[] = [];

  for (const node of content) {
    // Clone the node to avoid modifying the original data directly
    let processedNode = { ...node };

    if (node.type === 'image' && node.attrs?.src?.startsWith('blob:')) {
      const blobUrl = node.attrs.src;
      const pendingUpload = pendingUploads.get(blobUrl);

      if (pendingUpload) {
        try {
          const imagekitUrl = await uploadToImageKit(pendingUpload.file);
          // Update the cloned node's attributes
          processedNode.attrs = { ...processedNode.attrs, src: imagekitUrl };
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
