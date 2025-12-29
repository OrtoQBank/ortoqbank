'use client';

import { Editor } from '@tiptap/react';
import { ImageIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { toast } from '@/hooks/use-toast';

import type { ImageAttributes } from './rich-text-editor';

// Keep track of temporary images
interface PendingUpload {
  file: File;
  blobUrl: string;
}

// Use a Map to store pending uploads globally
export const pendingUploads = new Map<string, PendingUpload>();

// File size limit in MB (should match server-side limit)
const MAX_FILE_SIZE_MB = 8;

/**
 * Validates file size and shows toast if too large.
 * Returns true if valid, false if too large.
 */
function validateFileSize(file: File): boolean {
  const fileSizeMB = file.size / (1024 * 1024);

  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    console.error('[ImageUpload] File too large:', {
      fileName: file.name,
      fileSizeMB: fileSizeMB.toFixed(2),
      maxSizeMB: MAX_FILE_SIZE_MB,
    });

    toast({
      title: 'Imagem muito grande',
      description: `O arquivo "${file.name}" tem ${fileSizeMB.toFixed(1)}MB. O tamanho máximo permitido é ${MAX_FILE_SIZE_MB}MB. Por favor, reduza o tamanho da imagem antes de enviar.`,
      variant: 'destructive',
      duration: 8000,
    });

    return false;
  }

  console.log('[ImageUpload] File size validated:', {
    fileName: file.name,
    fileSizeMB: fileSizeMB.toFixed(2),
  });

  return true;
}

export function ImageUploadButton({ editor }: { editor: Editor }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file size before processing
      if (!validateFileSize(file)) {
        if (inputRef.current) {
          inputRef.current.value = '';
        }
        return;
      }

      try {
        setIsLoading(true);

        // Create temporary blob URL
        const blobUrl = URL.createObjectURL(file);

        // Store file and blobUrl for later upload
        pendingUploads.set(blobUrl, { file, blobUrl });

        console.log('[ImageUpload] Image added to pending uploads:', {
          fileName: file.name,
          blobUrl: blobUrl.slice(0, 50) + '...',
          pendingUploadsSize: pendingUploads.size,
        });

        // Insert blob URL into editor with resizable style
        const imageAttributes: ImageAttributes = {
          src: blobUrl,
          alt: file.name,
          style: 'width: 250px; height: auto; resize: both; overflow: hidden;',
        };

        editor.chain().focus().setImage(imageAttributes).run();
      } catch (error) {
        console.error('[ImageUpload] Failed to handle image:', error);
        toast({
          title: 'Erro ao adicionar imagem',
          description: 'Não foi possível processar a imagem. Tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }
    },
    [editor],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-md p-2 hover:bg-gray-100"
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        ) : (
          <ImageIcon className="h-5 w-5" />
        )}
      </button>
    </>
  );
}
