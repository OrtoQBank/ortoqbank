'use client';

import { useMutation, useQuery } from 'convex/react';
import {
  BookOpen,
  Calendar,
  Check,
  Clock,
  Edit,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';

interface QuizCardProps {
  quiz: {
    _id: Id<'customQuizzes'>;
    name: string;
    description: string;
    questions: Id<'questions'>[];
    testMode: 'study' | 'exam';
    questionMode?: string;
    _creationTime: number;
    // We'll keep these fields optional
    themes?: any;
    subthemes?: any;
    groups?: any;
    selectedThemes?: any;
    selectedSubthemes?: any;
    selectedGroups?: any;
  };
  hasResults: boolean;
  themeMap: Record<string, string>;
  subthemeMap: Record<string, string>;
  groupMap: Record<string, string>;
  formatRelativeTime: (timestamp: number) => string;
}

export function QuizCard({
  quiz,
  hasResults,
  themeMap,
  subthemeMap,
  groupMap,
  formatRelativeTime,
}: QuizCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(quiz.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get the mutations from Convex
  const updateQuizName = useMutation(api.customQuizzes.updateName);
  const startQuizSession = useMutation(api.quizSessions.startQuizSession);
  const deleteQuiz = useMutation(api.customQuizzes.deleteCustomQuiz);

  // Check if there's a completed session for this quiz
  const completedSession = useQuery(
    api.quizSessions.getLatestCompletedSession,
    {
      quizId: quiz._id,
    },
  );

  // Focus the input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Handle save changes
  const handleSave = async () => {
    if (newName.trim() === '') {
      toast({
        title: 'Nome inválido',
        description: 'O nome do teste não pode estar vazio.',
        variant: 'destructive',
      });
      return;
    }

    if (newName !== quiz.name) {
      try {
        await updateQuizName({
          id: quiz._id,
          name: newName,
        });
        toast({
          title: 'Nome atualizado',
          description: 'O nome do teste foi atualizado com sucesso.',
        });
      } catch (error) {
        console.error('Error updating quiz name:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível atualizar o nome do teste.',
          variant: 'destructive',
        });
        // Reset to original name on error
        setNewName(quiz.name);
      }
    }

    setIsEditing(false);
  };

  // Handle cancel
  const handleCancel = () => {
    setNewName(quiz.name);
    setIsEditing(false);
  };

  // Handle key press events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Handle start quiz click
  const handleStartQuiz = () => {
    if (hasResults) {
      // If there are results, show the dialog
      setShowDialog(true);
    } else {
      // If no results, start new session immediately
      router.push(`/criar-teste/${quiz._id}`);
    }
  };

  // Start a new session
  const handleStartNewSession = async () => {
    try {
      await startQuizSession({
        quizId: quiz._id,
        mode: quiz.testMode,
      });
      router.push(`/criar-teste/${quiz._id}`);
    } catch (error) {
      console.error('Error starting new session:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar uma nova sessão.',
        variant: 'destructive',
      });
    }
  };

  // View previous results
  const handleViewResults = () => {
    router.push(`/quiz-results/${quiz._id}`);
    setShowDialog(false);
  };

  // Handle delete quiz
  const handleDeleteQuiz = async () => {
    setIsDeleting(true);
    try {
      await deleteQuiz({ quizId: quiz._id });
      toast({
        title: 'Teste excluído',
        description: 'O teste foi excluído com sucesso.',
      });
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o teste. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Simplified approach to get theme IDs
  let themeIds: string[] = [];
  if (quiz.themes && Array.isArray(quiz.themes)) {
    themeIds = quiz.themes;
  } else if (quiz.selectedThemes && Array.isArray(quiz.selectedThemes)) {
    themeIds = quiz.selectedThemes;
  }

  // Simplified approach to get subtheme IDs
  let subthemeIds: string[] = [];
  if (quiz.subthemes && Array.isArray(quiz.subthemes)) {
    subthemeIds = quiz.subthemes;
  } else if (quiz.selectedSubthemes && Array.isArray(quiz.selectedSubthemes)) {
    subthemeIds = quiz.selectedSubthemes;
  }

  // Simplified approach to get group IDs
  let groupIds: string[] = [];
  if (quiz.groups && Array.isArray(quiz.groups)) {
    groupIds = quiz.groups;
  } else if (quiz.selectedGroups && Array.isArray(quiz.selectedGroups)) {
    groupIds = quiz.selectedGroups;
  }

  // Map IDs to actual names using the lookup maps
  const themeNames = themeIds.map(id => themeMap[id] || 'Tema').filter(Boolean);
  const subthemeNames = subthemeIds
    .map(id => subthemeMap[id] || 'Subtema')
    .filter(Boolean);
  const groupNames = groupIds
    .map(id => groupMap[id] || 'Grupo')
    .filter(Boolean);

  return (
    <>
      <Card className="group overflow-hidden">
        <CardHeader className="bg-muted/40 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {quiz.testMode === 'exam' ? (
                <Clock className="h-4 w-4 text-amber-500" />
              ) : (
                <BookOpen className="h-4 w-4 text-emerald-500" />
              )}
              <span className="text-muted-foreground text-xs">
                {quiz.testMode === 'exam' ? 'Simulado' : 'Estudo'}
              </span>
            </div>
            <div className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">{formatDate(quiz._creationTime)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 text-lg font-bold"
              />
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  className="h-8 w-8 p-0"
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <h3 className="line-clamp-1 text-lg font-bold">{quiz.name}</h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-6 w-6 p-0"
                  title="Editar nome"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                  title="Excluir teste"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {quiz.description}
          </p>

          {/* Quiz Configuration Options */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {quiz.questionMode && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                {quiz.questionMode === 'all' && 'Todas'}
                {quiz.questionMode === 'incorrect' && 'Incorretas'}
                {quiz.questionMode === 'bookmarked' && 'Favoritadas'}
                {quiz.questionMode === 'unanswered' && 'Não Respondidas'}
              </span>
            )}

            {themeNames.length > 0 && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                {themeNames.length > 1
                  ? `${themeNames.length} temas`
                  : themeNames[0]}
              </span>
            )}

            {subthemeNames.length > 0 && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                {subthemeNames.length > 1
                  ? `${subthemeNames.length} subtemas`
                  : subthemeNames[0]}
              </span>
            )}

            {groupNames.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                {groupNames.length > 1
                  ? `${groupNames.length} grupos`
                  : groupNames[0]}
              </span>
            )}

            <span className="bg-secondary rounded-full px-2 py-0.5 font-medium">
              {quiz.questions.length} questões
            </span>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 flex justify-between gap-2 pt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleStartQuiz}
          >
            Iniciar
          </Button>
          {hasResults && (
            <Link href={`/quiz-results/${quiz._id}`} className="flex-1">
              <Button className="w-full">Ver Resultados</Button>
            </Link>
          )}
        </CardFooter>
      </Card>

      {/* Dialog for handling completed quiz restart */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teste já realizado</DialogTitle>
            <DialogDescription>
              Você já completou este teste anteriormente. O que gostaria de
              fazer?
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="flex items-start space-x-3">
              <RotateCcw className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-blue" />
              <div>
                <h4 className="text-sm font-medium">Iniciar novo teste</h4>
                <p className="text-muted-foreground text-sm">
                  Comece uma nova sessão com as mesmas questões.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
              <div>
                <h4 className="text-sm font-medium">
                  Ver resultados anteriores
                </h4>
                <p className="text-muted-foreground text-sm">
                  Veja os resultados da sua sessão anterior.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 flex gap-2 sm:justify-start">
            <Button onClick={handleStartNewSession}>Iniciar novo teste</Button>
            <Button variant="outline" onClick={handleViewResults}>
              Ver resultados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir teste personalizado</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o teste &quot;{quiz.name}&quot;?
              Esta ação não pode ser desfeita e todos os resultados associados
              também serão removidos.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="destructive"
              onClick={handleDeleteQuiz}
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Excluir teste'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
