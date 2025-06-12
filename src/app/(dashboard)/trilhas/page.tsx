'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { useQuery } from 'convex-helpers/react/cache/hooks';
import { BookOpen, Clock, FileText } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';

// Component to render theme icons
const ThemeIcon = ({
  themeName,
  className = 'h-6 w-6 md:h-8 md:w-8',
}: {
  themeName: string;
  className?: string;
}) => {
  const iconMap: Record<string, string> = {
    'Oncologia Ortopédica': '/icons/tumor.webp',
    'Mão e Microcirurgia': '/icons/mao.webp',
    Coluna: '/icons/coluna.webp',
    'Ombro e Cotovelo': '/icons/ombro.webp',
    Joelho: '/icons/joelho.webp',
    Quadril: '/icons/quadril.webp',
    'Ortopedia Pediátrica': '/icons/pediatrica.webp',
    'Pé e Tornozelo': '/icons/pe.webp',
    'Ciências Básicas': '/icons/basicas.webp',
  };

  const iconSrc = iconMap[themeName];

  if (!iconSrc) {
    // Fallback to a default icon if theme name doesn't match
    return <div className={`${className} rounded-full bg-gray-200`} />;
  }

  return (
    <Image
      src={iconSrc}
      alt={`${themeName} icon`}
      width={32}
      height={32}
      className={className}
    />
  );
};

export default function ThemesPage() {
  const themesQuery = useQuery(api.themes.list);
  const themes = themesQuery || [];

  const presetQuizzesQuery = useQuery(api.presetQuizzes.list);
  const presetQuizzes = presetQuizzesQuery || [];

  const startSession = useMutation(api.quizSessions.startQuizSession);
  const { user } = useUser();
  const router = useRouter();

  // Query to get incomplete sessions for the current user
  const incompleteSessionsQuery = useQuery(
    api.quizSessions.listIncompleteSessions,
  );
  const incompleteSessions = incompleteSessionsQuery || [];

  // Query to get all completed sessions for the current user
  const completedSessionsQuery = useQuery(
    api.quizSessions.getAllCompletedSessions,
  );
  const completedSessions = completedSessionsQuery || [];

  // Check if all data is loaded (queries return undefined while loading)
  const isLoading =
    themesQuery === undefined ||
    presetQuizzesQuery === undefined ||
    incompleteSessionsQuery === undefined ||
    completedSessionsQuery === undefined ||
    !user;

  // Sort themes by displayOrder (if available) or by name
  const sortedThemes = [...themes].sort((a, b) => {
    // If both have displayOrder, sort by that
    if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
      return a.displayOrder - b.displayOrder;
    }
    // If only a has displayOrder, a comes first
    if (a.displayOrder !== undefined) {
      return -1;
    }
    // If only b has displayOrder, b comes first
    if (b.displayOrder !== undefined) {
      return 1;
    }
    // If neither has displayOrder, sort by name
    return a.name.localeCompare(b.name);
  });

  // Filter quizzes to only show those with category = 'trilha'
  const trilhasQuizzes = presetQuizzes.filter(
    quiz => quiz.category === 'trilha',
  );

  // Sort trilhasQuizzes by displayOrder (if available) or by name
  const sortedTrilhasQuizzes = [...trilhasQuizzes].sort((a, b) => {
    // If both have displayOrder, sort by that
    if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
      return a.displayOrder - b.displayOrder;
    }
    // If only a has displayOrder, a comes first
    if (a.displayOrder !== undefined) {
      return -1;
    }
    // If only b has displayOrder, b comes first
    if (b.displayOrder !== undefined) {
      return 1;
    }
    // If neither has displayOrder, sort by name
    return a.name.localeCompare(b.name);
  });

  // Create a map of quizId to sessionId for incomplete sessions
  const incompleteSessionMap = incompleteSessions.reduce(
    (map: Record<string, Id<'quizSessions'>>, session) => {
      map[session.quizId] = session._id;
      return map;
    },
    {} as Record<string, Id<'quizSessions'>>,
  );

  // Create a map to track which quizzes have completed sessions
  const hasCompletedSessionMap = completedSessions.reduce(
    (map: Record<string, boolean>, session) => {
      map[session.quizId] = true;
      return map;
    },
    {} as Record<string, boolean>,
  );

  // Group trilhas by theme
  const trilhasByTheme = sortedThemes.reduce(
    (accumulator, theme) => {
      const themeTrilhas = sortedTrilhasQuizzes.filter(
        quiz => quiz.themeId === theme._id,
      );

      if (themeTrilhas.length > 0) {
        accumulator[theme._id] = themeTrilhas;
      }

      return accumulator;
    },
    {} as Record<string, typeof sortedTrilhasQuizzes>,
  );

  const handleExamClick = async (quizId: Id<'presetQuizzes'>) => {
    // Check if there's an incomplete session for this quiz
    if (incompleteSessionMap[quizId]) {
      // Navigate to the tema quiz instead of preset-quiz
      router.push(`/trilhas/${quizId}`);
    } else {
      // Start a new session
      const { sessionId } = await startSession({
        quizId,
        mode: 'study',
      });
      router.push(`/trilhas/${quizId}`);
    }
  };

  // Show loading state while any data is still loading
  if (isLoading) {
    return (
      <div className="container mx-auto mt-10 rounded-lg border bg-white p-6">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Trilhas
        </h1>
        <div className="p-8 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
          <p className="text-gray-600">Carregando trilhas...</p>
        </div>
      </div>
    );
  }

  // If there are no trilhas for any theme (only show this after everything is loaded)
  if (Object.keys(trilhasByTheme).length === 0) {
    return (
      <div className="container mx-auto p-0 md:p-6">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Trilhas
        </h1>
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">
            Nenhuma trilha disponível no momento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto pt-4 md:p-6">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
        Trilhas
      </h1>
      <Accordion type="single" collapsible className="space-y-4">
        {Object.entries(trilhasByTheme).map(([themeId, trilhas]) => {
          const theme = themes.find(t => t._id === themeId);

          return (
            <AccordionItem
              key={themeId}
              value={themeId}
              className="overflow-hidden"
            >
              <AccordionTrigger className="hover:bg-muted/20 py-3 hover:no-underline md:px-4">
                <div className="flex items-center gap-3">
                  <ThemeIcon
                    themeName={theme?.name || 'Trilha'}
                    className="h-6 w-6 md:h-8 md:w-8"
                  />
                  <span className="font-medium md:text-xl">
                    {theme?.name || 'Trilha'}
                  </span>
                  <span className="text-muted-foreground text-md">
                    ({trilhas.length} testes)
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="divide-y">
                  {trilhas.map(exam => {
                    // Check if there's an incomplete session for this quiz
                    const hasIncompleteSession =
                      !!incompleteSessionMap[exam._id];

                    return (
                      <div
                        key={exam._id}
                        className="flex flex-col space-y-3 px-4 py-4"
                      >
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium">{exam.name}</h3>
                              {hasIncompleteSession ? (
                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 hover:text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/30 dark:hover:text-amber-400">
                                  <Clock className="mr-1 h-3 w-3" />
                                  Em andamento
                                </Badge>
                              ) : hasCompletedSessionMap[exam._id] ? (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/30 dark:hover:text-green-400">
                                  <BookOpen className="mr-1 h-3 w-3" />
                                  Concluído
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-400">
                                  <BookOpen className="mr-1 h-3 w-3" />
                                  Não iniciado
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <FileText className="text-muted-foreground h-3 w-3" />
                              <span className="text-muted-foreground text-md">
                                {exam.questions.length} questões
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 flex w-full flex-wrap gap-2 md:mt-0 md:w-auto">
                            <Button
                              onClick={() => handleExamClick(exam._id)}
                              className="flex-1 md:flex-none"
                            >
                              {hasIncompleteSession
                                ? 'Retomar Teste'
                                : hasCompletedSessionMap[exam._id]
                                  ? 'Refazer Teste'
                                  : 'Iniciar Teste'}
                            </Button>
                            {hasCompletedSessionMap[exam._id] && (
                              <Link
                                href={`/quiz-results/${exam._id}`}
                                className="flex-1 md:flex-none"
                              >
                                <Button variant="outline" className="w-full">
                                  Ver Resultados
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
