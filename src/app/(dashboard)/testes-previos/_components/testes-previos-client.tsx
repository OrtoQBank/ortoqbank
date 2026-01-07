'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenantQuery } from '@/hooks/useTenantQuery';
import { formatRelativeTime } from '@/lib/utils';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { QuizCard } from './quiz-card';

// Define quiz types for type safety
type Quiz = {
  _id: Id<'customQuizzes'>;
  name: string;
  description: string;
  questions: Id<'questions'>[];
  testMode: 'study' | 'exam';
  questionMode?: string;
  _creationTime: number;
  themes?: any;
  subthemes?: any;
  groups?: any;
  selectedThemes?: any;
  selectedSubthemes?: any;
  selectedGroups?: any;
};

// Main client component
export function TestesPreviosClient() {
  // No more need for Clerk user check - it's handled by the server component
  const [activeTab, setActiveTab] = useState('all');

  // Always fetch data using tenant-aware queries
  const customQuizzesResult = useTenantQuery(
    api.customQuizzes.getCustomQuizzes,
    {},
  );
  const themesResult = useTenantQuery(api.themes.list, {});
  const subthemesResult = useTenantQuery(api.subthemes.list, {});
  const groupsResult = useTenantQuery(api.groups.list, {});
  const completedSessionsResult = useTenantQuery(
    api.quizSessions.getCompletedQuizIds,
    {},
  );

  // Check if data is still loading
  const isDataLoading =
    customQuizzesResult === undefined ||
    themesResult === undefined ||
    subthemesResult === undefined ||
    groupsResult === undefined ||
    completedSessionsResult === undefined;

  // Show loading state while data is being fetched
  if (isDataLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold">Carregando dados...</h2>
          </div>
        </div>
      </div>
    );
  }

  // Apply fallbacks for consistency
  const customQuizzes = customQuizzesResult || [];
  const themes = themesResult || [];
  const subthemes = subthemesResult || [];
  const groups = groupsResult || [];
  const completedSessions = completedSessionsResult || [];

  // Create lookup maps with a simple approach
  const themeMap: Record<string, string> = {};
  themes.forEach((theme: { _id: string; name: string }) => {
    themeMap[theme._id] = theme.name;
  });

  const subthemeMap: Record<string, string> = {};
  subthemes.forEach((subtheme: { _id: string; name: string }) => {
    subthemeMap[subtheme._id] = subtheme.name;
  });

  const groupMap: Record<string, string> = {};
  groups.forEach((group: { _id: string; name: string }) => {
    groupMap[group._id] = group.name;
  });

  // Create a map of quiz IDs to check if they have completed sessions
  const completedQuizIds = new Set(
    completedSessions.map(session => session.quizId),
  );

  // Empty state - but only when we know data has properly loaded
  if (customQuizzes.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="mb-6 text-2xl font-bold">Meus Testes Personalizados</h1>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold">
              Nenhum teste personalizado encontrado
            </h2>
            <p className="text-muted-foreground mt-2">
              Você ainda não criou nenhum teste personalizado.
            </p>
            <Link href="/criar-teste">
              <Button className="mt-6">
                <Plus className="mr-2 h-4 w-4" />
                Criar Teste Personalizado
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Prepare filtered lists only once
  const examQuizzes = customQuizzes.filter(quiz => quiz.testMode === 'exam');
  const studyQuizzes = customQuizzes.filter(quiz => quiz.testMode === 'study');

  // Helper function to render quiz cards grid
  const renderQuizCards = (quizzes: Quiz[]) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {quizzes.map((quiz: Quiz) => (
        <QuizCard
          key={quiz._id}
          quiz={quiz}
          hasResults={completedQuizIds.has(quiz._id)}
          themeMap={themeMap}
          subthemeMap={subthemeMap}
          groupMap={groupMap}
          formatRelativeTime={formatRelativeTime}
        />
      ))}
    </div>
  );

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Meus Testes Personalizados</h1>
        <Link href="/criar-teste">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Criar Novo Teste
          </Button>
        </Link>
      </div>

      <Tabs
        defaultValue="all"
        className="mb-8"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="exam">Simulados</TabsTrigger>
          <TabsTrigger value="study">Estudo</TabsTrigger>
        </TabsList>
        <Separator className="mb-6" />

        <TabsContent value="all" className="space-y-4">
          {renderQuizCards(customQuizzes as Quiz[])}
        </TabsContent>

        <TabsContent value="exam" className="space-y-4">
          {renderQuizCards(examQuizzes as Quiz[])}
        </TabsContent>

        <TabsContent value="study" className="space-y-4">
          {renderQuizCards(studyQuizzes as Quiz[])}
        </TabsContent>
      </Tabs>
    </div>
  );
}
