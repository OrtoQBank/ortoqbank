 

'use client';

import { Editor } from '@tiptap/react';
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  RedoIcon,
  StrikethroughIcon,
  UnderlineIcon,
  UndoIcon,
} from 'lucide-react';
import * as React from 'react';
import { memo, useCallback } from 'react';

import { ImageUploadButton } from './image-upload-button';

// Button component with loading state
function Button({
  onClick,
  isActive,
  disabled,
  children,
  isLoading,
  'aria-label': ariaLabel,
}: {
  onClick: () => void;
  isActive: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  isLoading?: boolean;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label={ariaLabel}
      className={`relative p-2 ${
        isActive ? 'rounded-md bg-violet-500 text-white' : ''
      } ${disabled || isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-white/50">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      )}
      {children}
    </button>
  );
}

const ColorPicker = memo(({ editor }: { editor: Editor }) => {
  const onColorInput = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const color = (event.target as HTMLInputElement).value;
      editor.chain().focus().setColor(color).run();
    },
    [editor],
  );

  return (
    <input
      type="color"
      onInput={onColorInput}
      value={editor.getAttributes('textStyle').color || '#000000'}
      data-testid="setColor"
    />
  );
});
ColorPicker.displayName = 'ColorPicker';

export default function TextEditorMenuBar({
  editor,
}: {
  editor: Editor | null;
}) {
  if (!editor) return null;

  const buttons = [
    {
      icon: <BoldIcon className="h-5 w-5" />,
      onClick: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      label: 'Bold',
    },

    {
      icon: <UnderlineIcon className="h-5 w-5" />,
      onClick: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
      label: 'Underline',
    },

    {
      icon: <ItalicIcon className="h-5 w-5" />,
      onClick: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      disabled: !editor.can().chain().focus().toggleItalic().run(),
      label: 'Italic',
    },
    {
      icon: <StrikethroughIcon className="h-5 w-5" />,
      onClick: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive('strike'),
      disabled: !editor.can().chain().focus().toggleStrike().run(),
      label: 'Strikethrough',
    },
    {
      icon: <ListIcon className="h-5 w-5" />,
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
      label: 'Bullet List',
    },
    {
      icon: <ListOrderedIcon className="h-5 w-5" />,
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
      disabled: !editor.can().chain().focus().toggleOrderedList().run(),
      label: 'Ordered List',
    },
    {
      icon: <UndoIcon className="h-5 w-5" />,
      onClick: () => editor.chain().focus().undo().run(),
      isActive: false,
      disabled: !editor.can().chain().focus().undo().run(),
      label: 'Undo',
    },
    {
      icon: <RedoIcon className="h-5 w-5" />,
      onClick: () => editor.chain().focus().redo().run(),
      isActive: false,
      disabled: !editor.can().chain().focus().redo().run(),
      label: 'Redo',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        {buttons.map(({ icon, onClick, isActive, disabled, label }, index) => (
          <Button
            key={index}
            onClick={onClick}
            isActive={isActive}
            disabled={disabled}
            aria-label={label}
          >
            {icon}
          </Button>
        ))}
        <ImageUploadButton editor={editor} />
        {editor && <ColorPicker editor={editor} />}
      </div>
    </div>
  );
}
