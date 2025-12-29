import Image from 'next/image';
import React from 'react';

// Define a basic type for the content nodes.
// You might want to refine this based on all possible node types and attributes from your editor.
export interface ContentNode {
  type: string;
  text?: string;
  marks?: Array<{
    type: string;
    attrs?: { [key: string]: any };
    [key: string]: any;
  }>; // Allow additional mark attributes like color
  content?: ContentNode[];
  attrs?: { [key: string]: any }; // Handle attributes like for images or links
}

// Props for the main renderer component
// Update to accept either a ContentNode object or a string representation
// Also add support for the future migration path with dedicated string fields
interface StructuredContentRendererProps {
  node?: ContentNode | string | null | undefined;
  // Support for the new migration fields
  stringContent?: string | null | undefined;
}

// Helper function to parse a string to ContentNode
function parseContentNode(
  content: string | ContentNode,
): ContentNode | undefined {
  if (typeof content === 'string') {
    try {
      return JSON.parse(content) as ContentNode;
    } catch (error) {
      console.error('Failed to parse content string:', error);
      return undefined;
    }
  }
  return content;
}

// Helper function to render a single node
function renderNode(node: ContentNode, key: string | number): React.ReactNode {
  let children: React.ReactNode = undefined;
  if (node.content) {
    // Recursively render child nodes
    children = node.content.map((childNode, index) =>
      renderNode(childNode, `${key}-${index}`),
    );
  }

  let element: React.ReactNode;

  switch (node.type) {
    case 'doc': {
      // The root 'doc' node just renders its children
      element = <>{children}</>;
      break;
    }
    case 'paragraph': {
      // Render paragraph, handling empty paragraphs potentially
      element = (
        <p key={key} className="whitespace-pre-wrap">
          {children || <br />}
        </p>
      );
      break;
    }
    case 'bulletList': {
      element = (
        <ul key={key} className="list-disc space-y-1 pl-5">
          {children}
        </ul>
      );
      break;
    }
    case 'orderedList': {
      element = (
        <ol key={key} className="list-decimal space-y-1 pl-5">
          {children}
        </ol>
      );
      break;
    }
    case 'listItem': {
      // List items render their children (which are often paragraphs)
      element = <li key={key}>{children}</li>;
      break;
    }
    case 'text': {
      // Apply marks to text nodes
      let textElement: React.ReactNode = <>{node.text}</>;
      let currentStyle: React.CSSProperties = {};

      if (node.marks) {
        node.marks.forEach(mark => {
          switch (mark.type) {
            case 'bold': {
              textElement = <strong>{textElement}</strong>;
              break;
            }
            case 'italic': {
              textElement = <em>{textElement}</em>;
              break;
            }
            case 'underline': {
              textElement = <u>{textElement}</u>;
              break;
            }
            case 'strike': {
              textElement = <s>{textElement}</s>;
              break;
            }
            case 'textStyle': {
              if (mark.attrs?.color) {
                currentStyle.color = mark.attrs.color;
              }
              break;
            }
            default: {
              break;
            }
          }
        });
      }
      // Apply inline styles if any exist
      if (Object.keys(currentStyle).length > 0) {
        textElement = <span style={currentStyle}>{textElement}</span>;
      }
      // Assign the final fragment to the element variable
      element = <React.Fragment key={key}>{textElement}</React.Fragment>;
      break;
    }
    case 'hardBreak': {
      element = <br key={key} />;
      break;
    }
    case 'image':
    case 'imageResize': {
      // Handle both standard image and imageResize from tiptap-extension-resize-image
      const { src, alt, width, height, style, wrapperStyle } =
        node.attrs || {};
      // Basic image rendering, consider adding error handling or placeholders

      // Parse the style string into an object
      const parsedStyles: Record<string, string> = {};
      if (typeof style === 'string') {
        style.split(';').forEach(declaration => {
          const [property, value] = declaration.split(':');
          if (property && value) {
            // Convert kebab-case to camelCase for React style properties
            const camelCaseProperty = property
              .trim()
              .replaceAll(/-([a-z])/g, g => g[1].toUpperCase());
            parsedStyles[camelCaseProperty] = value.trim();
          }
        });
      }

      // Parse wrapperStyle for imageResize nodes (e.g., "display: flex")
      const parsedWrapperStyles: Record<string, string> = {};
      if (typeof wrapperStyle === 'string') {
        wrapperStyle.split(';').forEach(declaration => {
          const [property, value] = declaration.split(':');
          if (property && value) {
            const camelCaseProperty = property
              .trim()
              .replaceAll(/-([a-z])/g, g => g[1].toUpperCase());
            parsedWrapperStyles[camelCaseProperty] = value.trim();
          }
        });
      }

      const imgElement = (
        <img
          key={key}
          src={src}
          alt={alt || ''}
          width={width} // Keep width/height attributes if they exist for semantics/SSR
          height={height}
          style={parsedStyles as React.CSSProperties} // Apply the parsed style object, cast to CSSProperties
        />
      );

      // Wrap in a container if wrapperStyle exists (for imageResize centering/alignment)
      if (Object.keys(parsedWrapperStyles).length > 0) {
        element = (
          <div key={key} style={parsedWrapperStyles as React.CSSProperties}>
            {imgElement}
          </div>
        );
      } else {
        element = imgElement;
      }
      break;
    }
    case 'heading': {
      // Handle headings with different levels
      const level = node.attrs?.level || 1;
      const tag = `h${Math.min(Math.max(level, 1), 6)}`;

      element = React.createElement(
        tag,
        {
          key,
          className: `font-bold ${
            level === 1
              ? 'text-2xl mb-4'
              : level === 2
                ? 'text-xl mb-3'
                : level === 3
                  ? 'text-lg mb-2'
                  : level === 4
                    ? 'text-base mb-2'
                    : level === 5
                      ? 'text-sm mb-1'
                      : 'text-xs mb-1'
          }`,
        },
        children,
      );
      break;
    }
    case 'blockquote': {
      element = (
        <blockquote
          key={key}
          className="my-4 border-l-4 border-gray-300 pl-4 text-gray-700 italic"
        >
          {children}
        </blockquote>
      );
      break;
    }
    default: {
      console.warn(`Unsupported node type: ${node.type}`);
      element = undefined;
      break;
    }
  }

  return element;
}

export default function StructuredContentRenderer({
  node,
  stringContent,
}: StructuredContentRendererProps) {
  // First try the dedicated string field (future migration path)
  if (stringContent) {
    const parsedContent = parseContentNode(stringContent);
    if (parsedContent) {
      return <>{renderNode(parsedContent, 'root')}</>;
    }
  }

  // Fall back to the original node field
  if (!node) {
    return;
  }

  const parsedNode = parseContentNode(node);
  if (!parsedNode) {
    return;
  }

  return <>{renderNode(parsedNode, 'root')}</>;
}
