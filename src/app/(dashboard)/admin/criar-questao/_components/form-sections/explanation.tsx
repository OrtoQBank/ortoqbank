'use client';

import { type UseFormReturn } from 'react-hook-form';

import RichTextEditor from '@/components/rich-text-editor/rich-text-editor';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { QuestionFormData } from '../schema';

interface ExplanationProps {
  form: UseFormReturn<QuestionFormData>;
  initialContent?: any;
  onEditorReady: (editor: any) => void;
}

export function Explanation({
  form,
  initialContent,
  onEditorReady,
}: ExplanationProps) {
  return (
    <FormField
      control={form.control}
      name="explanationText"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Explicação</FormLabel>
          <FormControl>
            <RichTextEditor
              onChange={field.onChange}
              initialContent={initialContent}
              onEditorReady={onEditorReady}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
