'use client';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { useQuestionForm } from '../_hooks/use-question-form';
import { Alternatives } from './form-sections/alternatives';
import { Explanation } from './form-sections/explanation';
import { QuestionText } from './form-sections/question-text';
import { Taxonomy } from './form-sections/taxonomy';
import { QuestionIdDisplay } from './question-id-display';

interface QuestionFormProps {
  mode?: 'create' | 'edit';
  defaultValues?: any;
  onSuccess?: () => void;
}

export function QuestionForm({
  mode = 'create',
  defaultValues,
  onSuccess,
}: QuestionFormProps) {
  // Use the custom hook to handle form logic
  const {
    form,
    taxonomy,
    onSubmit,
    isSubmitting,
    setQuestionEditor,
    setExplanationEditor,
    getButtonText,
  } = useQuestionForm({ mode, defaultValues, onSuccess });

  return (
    <div className="rounded-lg border bg-white p-4">
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Title Field */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Título da Questão</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Question Text with Rich Text Editor */}
          <QuestionText
            form={form}
            initialContent={defaultValues?.questionTextString}
            onEditorReady={setQuestionEditor}
          />

          {/* Multiple-choice Alternatives */}
          <Alternatives form={form} />

          {/* Explanation with Rich Text Editor */}
          <Explanation
            form={form}
            initialContent={defaultValues?.explanationTextString}
            onEditorReady={setExplanationEditor}
          />

          {/* Taxonomy (Theme, Subtheme, Group) */}
          <Taxonomy
            form={form}
            themes={taxonomy.themes}
            subthemes={taxonomy.subthemes}
            groups={taxonomy.groups}
            onThemeChange={taxonomy.setSelectedTheme}
            onSubthemeChange={taxonomy.setSelectedSubtheme}
            selectedTheme={taxonomy.selectedTheme}
            selectedSubtheme={taxonomy.selectedSubtheme}
          />

          {/* Display generated question ID */}
          <QuestionIdDisplay generatedId={taxonomy.generatedId} />

          {/* Submit Button */}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {getButtonText()}
          </Button>
        </form>
      </Form>
    </div>
  );
}
