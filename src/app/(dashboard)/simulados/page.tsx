'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { useQuery } from 'convex-helpers/react/cache/hooks';
import {
  Baby,
  Bone,
  Book,
  BookOpen,
  Brain,
  CheckCircle,
  Clock,
  FileText,
  Gauge,
  LayoutDashboard,
  Microscope,
  Stethoscope,
} from 'lucide-react';
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

// Subcategory icons mapping
const SUBCATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  TARO: Book,
  TEOT: Book,
  Simulados: Stethoscope,
  Pediatria: Baby,
  Ortopedia: Bone,
  Neurologia: Brain,
  Cardiologia: Gauge,
  Geral: LayoutDashboard,
  Laboratório: Microscope,
  // Default icon for other subcategories
  default: Book,
};

// Define the preferred order for the subcategories
const PREFERRED_SUBCATEGORY_ORDER = [
  'TARO',
  'TEOT',
  'Simulados',
  'Pediatria',
  'Ortopedia',
  'Neurologia',
  'Cardiologia',
  'Geral',
];

function getStatusBadge(status: 'not_started' | 'in_progress' | 'completed') {
  switch (status) {
    case 'completed': {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/30 dark:hover:text-green-400">
          <CheckCircle className="mr-1 h-3 w-3" />
          Concluído
        </Badge>
      );
    }
    case 'in_progress': {
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 hover:text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/30 dark:hover:text-amber-400">
          <Clock className="mr-1 h-3 w-3" />
          Em andamento
        </Badge>
      );
    }
    case 'not_started': {
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-400">
          <BookOpen className="mr-1 h-3 w-3" />
          Não iniciado
        </Badge>
      );
    }
  }
}

export default function SimuladoPage() {
  const { user } = useUser();
  const router = useRouter();

  // Fetch all presetQuizzes
  const presetQuizzesQuery = useQuery(api.presetQuizzes.list);
  const presetQuizzes = presetQuizzesQuery || [];

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

  // Start session mutation
  const startSession = useMutation(api.quizSessions.startQuizSession);

  // Check if all data is loaded (queries return undefined while loading)
  const isLoading =
    presetQuizzesQuery === undefined ||
    incompleteSessionsQuery === undefined ||
    completedSessionsQuery === undefined ||
    !user;

  // Filter to only show simulados (category = "simulado")
  const simulados = presetQuizzes.filter(quiz => quiz.category === 'simulado');

  // Group simulados by subcategory
  const simuladosBySubcategory: Record<string, typeof simulados> = {};

  // First, separate simulados by subcategory
  simulados.forEach(simulado => {
    const subcategory = simulado.subcategory || 'Simulados'; // Default to 'Simulados' if no subcategory
    if (!simuladosBySubcategory[subcategory]) {
      simuladosBySubcategory[subcategory] = [];
    }
    simuladosBySubcategory[subcategory].push(simulado);
  });

  // Sort simulados within each subcategory by displayOrder and then by name
  Object.keys(simuladosBySubcategory).forEach(subcategory => {
    simuladosBySubcategory[subcategory].sort((a, b) => {
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
  });

  // Determine the subcategory order to use
  // Start with the existing subcategories in preferred order
  const availableSubcategories = Object.keys(simuladosBySubcategory);
  const subcategoryOrder = [
    // First include subcategories in the preferred order
    ...PREFERRED_SUBCATEGORY_ORDER.filter(sc =>
      availableSubcategories.includes(sc),
    ),
    // Then include any additional subcategories not in the preferred order
    ...availableSubcategories.filter(
      sc => !PREFERRED_SUBCATEGORY_ORDER.includes(sc),
    ),
  ];

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

  // Handle quiz start/resume
  const handleExamClick = async (quizId: Id<'presetQuizzes'>) => {
    // Check if there's an incomplete session for this quiz
    if (incompleteSessionMap[quizId]) {
      // Navigate to the simulado quiz instead of preset-quiz
      router.push(`/simulados/${quizId}`);
    } else {
      // Start a new session
      const { sessionId } = await startSession({
        quizId,
        mode: 'exam',
      });
      router.push(`/simulados/${quizId}`);
    }
  };

  // Show loading state while any data is still loading
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Simulados
        </h1>
        <div className="p-8 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
          <p className="text-gray-600">Carregando simulados...</p>
        </div>
      </div>
    );
  }

  // If there are no simulados (only show this after everything is loaded)
  if (Object.keys(simuladosBySubcategory).length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Simulados
        </h1>
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">
            Nenhum simulado disponível no momento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
        Simulados
      </h1>
        <Accordion
          type="single"
          collapsible
          className="space-y-4"
          defaultValue={subcategoryOrder[0]}
        >
        {subcategoryOrder.map(subcategory => {
          const simulados = simuladosBySubcategory[subcategory] || [];
          if (simulados.length === 0) return;

          // Get the appropriate icon for this subcategory
          const Icon =
            SUBCATEGORY_ICONS[subcategory] || SUBCATEGORY_ICONS.default;

          return (
            <AccordionItem
              key={subcategory}
              value={subcategory}
              className="overflow-hidden"
            >
              <AccordionTrigger className="hover:bg-muted/20 py-3 hover:no-underline md:px-4">
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6 md:h-8 md:w-8" />
                  <span className="font-medium md:text-xl">{subcategory}</span>
                  <span className="text-muted-foreground text-md">
                    ({simulados.length} simulado
                    {simulados.length === 1 ? '' : 's'})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="divide-y">
                  {simulados.map(simulado => {
                    // Check if there's an incomplete session for this quiz
                    const hasIncompleteSession =
                      !!incompleteSessionMap[simulado._id];
                    const status = hasIncompleteSession
                      ? 'in_progress'
                      : hasCompletedSessionMap[simulado._id]
                        ? 'completed'
                        : 'not_started';

                    return (
                      <div
                        key={simulado._id}
                        className="flex flex-col space-y-3 px-4 py-4"
                      >
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium">{simulado.name}</h3>
                              {getStatusBadge(status)}
                            </div>
                            <p className="text-muted-foreground text-md">
                              {simulado.description}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <FileText className="text-muted-foreground h-3 w-3" />
                              <span className="text-muted-foreground text-md">
                                {simulado.questions.length} questões
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex w-full flex-wrap gap-2 md:mt-0 md:w-auto">
                            <Button
                              className="flex-1 md:flex-none"
                              onClick={() => handleExamClick(simulado._id)}
                            >
                              {hasIncompleteSession
                                ? 'Retomar Teste'
                                : status === 'completed'
                                  ? 'Refazer Teste'
                                  : 'Iniciar Teste'}
                            </Button>

                            {hasCompletedSessionMap[simulado._id] && (
                              <Link href={`/quiz-results/${simulado._id}`}>
                                <Button
                                  variant="outline"
                                  className="flex-1 md:flex-none"
                                >
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
