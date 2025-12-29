'use client';

import { Color } from '@tiptap/extension-color';
import ImageExtension from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKitExtension from '@tiptap/starter-kit';
import { useEffect } from 'react';
import ResizeImage from 'tiptap-extension-resize-image';

import { toast } from '@/hooks/use-toast';

import TextEditorMenuBar from './editor-menu-bar';
import { pendingUploads } from './image-upload-button';
import { IMAGE_OPTIMIZATION } from './upload-action';

interface RichTextEditorProps {
  onChange?: (value: any) => void;
  initialContent?: any;
  onEditorReady?: (editor: any) => void;
}

type ImageAttributes = { src: string; alt?: string; style?: string };

const ExtendedImage = ImageExtension.extend({
  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: undefined },
      style: { default: undefined },
    };
  },
});

export default function RichTextEditor({
  onChange,
  initialContent,
  onEditorReady,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKitExtension,
      ExtendedImage,
      ResizeImage,
      Color,
      TextStyle,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class:
          'min-h-[150px] cursor-text rounded-md border p-5 ring-offset-background focus-within:outline-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        role: 'textbox',
        'aria-label': 'Rich text editor',
      },
      handlePaste: (view, event) => {
        if (!editor) return false;

        // Process images from clipboard
        const items = event.clipboardData?.items;
        if (items) {
          // Look for image data in the clipboard
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (!file) continue;

              // Prevent default paste behavior
              event.preventDefault();

              // Validate file size
              const fileSizeMB = file.size / (1024 * 1024);
              const maxSizeMB = IMAGE_OPTIMIZATION.MAX_FILE_SIZE_MB;
              if (fileSizeMB > maxSizeMB) {
                console.error('[ImagePaste] File too large:', {
                  fileName: file.name,
                  fileSizeMB: fileSizeMB.toFixed(2),
                  maxSizeMB,
                });

                toast({
                  title: 'Imagem muito grande',
                  description: `A imagem colada tem ${fileSizeMB.toFixed(1)}MB. O tamanho máximo permitido é ${maxSizeMB}MB. Por favor, reduza o tamanho da imagem antes de colar.`,
                  variant: 'destructive',
                  duration: 8000,
                });

                return true; // Consumed the event but didn't insert
              }

              // Handle the image file
              const blobUrl = URL.createObjectURL(file);
              pendingUploads.set(blobUrl, { file, blobUrl });

              console.log('[ImagePaste] Image added to pending uploads:', {
                fileName: file.name,
                fileSizeMB: fileSizeMB.toFixed(2),
                blobUrl: blobUrl.slice(0, 50) + '...',
                pendingUploadsSize: pendingUploads.size,
              });

              const imageAttributes: ImageAttributes = {
                src: blobUrl,
                alt: file.name,
                style:
                  'width: 250px; height: auto; resize: both; overflow: hidden;',
              };

              editor.chain().focus().setImage(imageAttributes).run();
              return true;
            }
          }
        }

        // Let Tiptap handle other paste events
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  return (
    <div className="rich-text-container">
      <style jsx global>{`
        .rich-text-container img {
          resize: both !important;
          overflow: hidden !important;
          max-width: 100%;
        }
      `}</style>
      <TextEditorMenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

// Export for use in image-upload-button
export type { ImageAttributes };
