'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { useQuery } from 'convex-helpers/react/cache/hooks';
import { BookOpen, Clock, FileText } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HoverPrefetchLink } from '@/components/ui/hover-prefetch-link';

import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';

const THEME_ICONS: Record<string, string> = {
  'Oncologia Ortopédica': '/icons/tumor.webp',
  'Mão e Microcirurgia': '/icons/mao.webp',
  Coluna: '/icons/coluna.webp',
  'Ombro e Cotovelo': '/icons/ombro.webp',
  Joelho: '/icons/joelho.webp',
  Quadril: '/icons/quadril.webp',
  'Ortopedia Pediátrica': '/icons/pediatrica.webp',
  'Pé e Tornozelo': '/icons/pe.webp',
  'Ciências Básicas': '/icons/basicas.webp',
  'Ortopedia Básica': '/icons/basicas.webp',
  Traumatologia: '/icons/tumor.webp',
  'Cirurgia do Joelho': '/icons/joelho.webp',
  'Cirurgia da Coluna': '/icons/coluna.webp',
};

const ThemeIcon = ({
  themeName,
  className = 'h-6 w-6 md:h-8 md:w-8',
}: {
  themeName: string;
  className?: string;
}) => {
  const iconSrc = THEME_ICONS[themeName];
  if (!iconSrc) {
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

export default function TrilhasPage() {
  const { user } = useUser();
  const router = useRouter();
  const startSession = useMutation(api.quizSessions.startQuizSession);

  const themesQuery = useQuery(api.themes.listSorted);
  const trilhasQuery = useQuery(api.presetQuizzes.listTrilhasSorted);
  const incompleteSessionsQuery = useQuery(
    api.quizSessions.listIncompleteSessions,
  );
  const completedSessionsQuery = useQuery(
    api.quizSessions.getAllCompletedSessions,
  );

  const isLoading =
    !user ||
    [
      themesQuery,
      trilhasQuery,
      incompleteSessionsQuery,
      completedSessionsQuery,
    ].includes(undefined);

  // Memoize data arrays to prevent unnecessary re-renders
  const themes = useMemo(() => themesQuery || [], [themesQuery]);
  const trilhas = useMemo(() => trilhasQuery || [], [trilhasQuery]);
  const incompleteSessions = useMemo(
    () => incompleteSessionsQuery || [],
    [incompleteSessionsQuery],
  );
  const completedSessions = useMemo(
    () => completedSessionsQuery || [],
    [completedSessionsQuery],
  );

  // Memoize expensive session map calculations
  const incompleteSessionMap = useMemo(() => {
    return incompleteSessions.reduce(
      (map, session) => {
        map[session.quizId] = session._id;
        return map;
      },
      {} as Record<string, Id<'quizSessions'>>,
    );
  }, [incompleteSessions]);

  const completedSessionMap = useMemo(() => {
    return completedSessions.reduce(
      (map, session) => {
        map[session.quizId] = true;
        return map;
      },
      {} as Record<string, boolean>,
    );
  }, [completedSessions]);

  // Memoize expensive trilhas grouping calculations
  const trilhasByTheme = useMemo(() => {
    return themes.reduce(
      (acc, theme) => {
        const themeTrilhas = trilhas.filter(quiz => quiz.themeId === theme._id);
        if (themeTrilhas.length > 0) {
          acc[theme._id] = { theme, trilhas: themeTrilhas };
        }
        return acc;
      },
      {} as Record<string, { theme: any; trilhas: any[] }>,
    );
  }, [themes, trilhas]);

  const orphanedTrilhas = useMemo(() => {
    const validThemeIds = new Set(themes.map(theme => theme._id));
    return trilhas.filter(
      quiz => quiz.themeId && !validThemeIds.has(quiz.themeId),
    );
  }, [themes, trilhas]);

  // Manual prefetching for routes users are likely to visit from trilhas page
  useEffect(() => {
    // Prefetch common routes that users navigate to from trilhas
    router.prefetch('/perfil'); // Users often check their progress
    router.prefetch('/simulados'); // Users might switch between trilhas and simulados

    // Prefetch the first few trilha routes if they exist
    if (trilhas.length > 0) {
      // Prefetch up to 3 most likely trilhas (first ones shown)
      trilhas.slice(0, 3).forEach(trilha => {
        router.prefetch(`/trilhas/${trilha._id}`);
      });
    }
  }, [router, trilhas]);

  const handleExamClick = useCallback(
    async (quizId: Id<'presetQuizzes'>) => {
      if (incompleteSessionMap[quizId]) {
        router.push(`/trilhas/${quizId}`);
      } else {
        await startSession({ quizId, mode: 'study' });
        router.push(`/trilhas/${quizId}`);
      }
    },
    [incompleteSessionMap, router, startSession],
  );

  const renderQuizCard = useCallback(
    (quiz: any) => {
      const hasIncompleteSession = !!incompleteSessionMap[quiz._id];
      const hasCompletedSession = !!completedSessionMap[quiz._id];

      return (
        <div key={quiz._id} className="flex flex-col space-y-3 px-4 py-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{quiz.name}</h3>
                <Badge
                  className={
                    hasIncompleteSession
                      ? 'bg-amber-100 text-amber-800'
                      : hasCompletedSession
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                  }
                >
                  {hasIncompleteSession && <Clock className="mr-1 h-3 w-3" />}
                  {hasCompletedSession && <BookOpen className="mr-1 h-3 w-3" />}
                  {!hasIncompleteSession && !hasCompletedSession && (
                    <BookOpen className="mr-1 h-3 w-3" />
                  )}
                  {hasIncompleteSession
                    ? 'Em andamento'
                    : hasCompletedSession
                      ? 'Concluído'
                      : 'Não iniciado'}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <FileText className="text-muted-foreground h-3 w-3" />
                <span className="text-muted-foreground text-md">
                  {quiz.questions.length} questões
                </span>
              </div>
            </div>
            <div className="mt-3 flex w-full flex-col gap-2 md:mt-0 md:w-auto md:flex-row">
              <Button
                onClick={() => handleExamClick(quiz._id)}
                className="flex-1 cursor-pointer md:flex-none"
              >
                {hasIncompleteSession
                  ? 'Retomar Teste'
                  : hasCompletedSession
                    ? 'Refazer Teste'
                    : 'Iniciar Teste'}
              </Button>
              {hasCompletedSession && (
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 cursor-pointer md:flex-none"
                >
                  <HoverPrefetchLink
                    href={`/quiz-results/${quiz._id}`}
                  >
                    Ver Resultados
                  </HoverPrefetchLink>
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    },
    [incompleteSessionMap, completedSessionMap, handleExamClick],
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-6">
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

  if (
    Object.keys(trilhasByTheme).length === 0 &&
    orphanedTrilhas.length === 0
  ) {
    return (
      <div className="rounded-lg border bg-white p-6">
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
    <div className="rounded-lg border bg-white p-6">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
        Trilhas
      </h1>
      <Accordion type="single" collapsible className="space-y-4">
        {Object.entries(trilhasByTheme).map(([themeId, { theme, trilhas }]) => (
          <AccordionItem
            key={themeId}
            value={themeId}
            className="overflow-hidden"
          >
            <AccordionTrigger className="hover:bg-muted/20 py-3 hover:no-underline md:px-4">
              <div className="flex items-center gap-3">
                <ThemeIcon themeName={theme.name} />
                <span className="font-medium md:text-xl">{theme.name}</span>
                <span className="text-muted-foreground text-md">
                  ({trilhas.length} testes)
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="divide-y">{trilhas.map(renderQuizCard)}</div>
            </AccordionContent>
          </AccordionItem>
        ))}

        {orphanedTrilhas.length > 0 && (
          <AccordionItem value="orphaned" className="overflow-hidden">
            <AccordionTrigger className="hover:bg-muted/20 py-3 hover:no-underline md:px-4">
              <div className="flex items-center gap-3">
                <ThemeIcon themeName="Outras Trilhas" />
                <span className="font-medium md:text-xl">Outras Trilhas</span>
                <span className="text-muted-foreground text-md">
                  ({orphanedTrilhas.length} testes)
                </span>
                <Badge variant="outline" className="ml-2 text-xs">
                  Tema em migração
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="divide-y">
                {orphanedTrilhas.map(renderQuizCard)}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
