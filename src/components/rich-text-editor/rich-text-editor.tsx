'use client';

import { Color } from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

import { toast } from '@/hooks/use-toast';

import { IMAGE_OPTIMIZATION } from './constants';
import TextEditorMenuBar from './editor-menu-bar';
import { pendingUploads } from './image-upload-button';

interface RichTextEditorProps {
  onChange?: (value: any) => void;
  initialContent?: any;
  onEditorReady?: (editor: any) => void;
}

export type ImageAttributes = {
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
};

export default function RichTextEditor({
  onChange,
  initialContent,
  onEditorReady,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit,
      Image.configure({
        inline: false,
        allowBase64: true,
        resize: {
          enabled: true,
          minWidth: 50,
          minHeight: 50,
        },
      }),
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

        const items = event.clipboardData?.items;
        if (items) {
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (!file) continue;

              event.preventDefault();

              const fileSizeMB = file.size / (1024 * 1024);
              const maxSizeMB = IMAGE_OPTIMIZATION.MAX_FILE_SIZE_MB;
              if (fileSizeMB > maxSizeMB) {
                toast({
                  title: 'Imagem muito grande',
                  description: `A imagem tem ${fileSizeMB.toFixed(1)}MB. Máximo: ${maxSizeMB}MB.`,
                  variant: 'destructive',
                });
                return true;
              }

              const blobUrl = URL.createObjectURL(file);
              pendingUploads.set(blobUrl, { file, blobUrl });

              editor.chain().focus().setImage({ src: blobUrl, alt: file.name }).run();
              return true;
            }
          }
        }
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
    <div>
      <TextEditorMenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
