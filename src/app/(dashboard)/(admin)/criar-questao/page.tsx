'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { QuestionForm } from './_components/question-form/question-form';
import { useThemeStore } from './_components/theme-form/store';
import { ThemeForm } from './_components/theme-form/theme-form';

export default function CreateQuestionPage() {
  const [activeTab, setActiveTab] = useState('question');
  const { setDialogOpen } = useThemeStore();

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Criar Questão</h1>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Tema
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="question">Questão</TabsTrigger>
          <TabsTrigger value="theme">Temas e Subtemas</TabsTrigger>
        </TabsList>
        <TabsContent value="question">
          <QuestionForm />
        </TabsContent>
        <TabsContent value="theme">
          <ThemeForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
