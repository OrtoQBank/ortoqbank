'use client';

import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';

import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';

interface EditQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quiz: {
    id: string;
    name: string;
    description: string;
    category?: 'trilha' | 'simulado';
    subcategory?: string;
    displayOrder?: number;
  };
  presetQuizzes: Array<{
    _id: Id<'presetQuizzes'>;
    name: string;
    description: string;
    questions: string[];
    category?: 'trilha' | 'simulado';
    subcategory?: string;
    displayOrder?: number;
  }>;
  onUpdateQuiz: (data: {
    name: string;
    description: string;
    category: 'trilha' | 'simulado';
    questions: string[];
    subcategory?: string;
    displayOrder?: number;
  }) => Promise<void>;
  onDeleteQuiz: () => Promise<void>;
}

export function EditExamDialog({
  open,
  onOpenChange,
  quiz,
  presetQuizzes,
  onUpdateQuiz,
  onDeleteQuiz,
}: EditQuizDialogProps) {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearchValue = useDebounce(searchInput, 500); // 500ms debounce delay
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(
    null,
  );

  const deleteQuestion = useMutation(api.questions.deleteQuestion);
  const [name, setName] = useState(quiz.name);
  const [description, setDescription] = useState(quiz.description);
  const [category, setCategory] = useState<'trilha' | 'simulado'>(
    quiz.category ||
      presetQuizzes.find(q => q._id === quiz.id)?.category ||
      'simulado',
  );
  const [subcategory, setSubcategory] = useState<string | undefined>(
    quiz.subcategory ||
      presetQuizzes.find(q => q._id === quiz.id)?.subcategory ||
      undefined,
  );
  const [displayOrder, setDisplayOrder] = useState<number | undefined>(
    quiz.displayOrder ||
      presetQuizzes.find(q => q._id === quiz.id)?.displayOrder ||
      undefined,
  );
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(
    new Set(presetQuizzes.find(q => q._id === quiz.id)?.questions),
  );

  // Clear subcategory when category changes to trilha
  useEffect(() => {
    if (category === 'trilha') {
      setSubcategory('');
    }
  }, [category]);

  // Use the searchByCode query instead of client-side filtering
  const searchResults =
    useQuery(
      api.questions.searchByCode,
      debouncedSearchValue.trim() ? { code: debouncedSearchValue } : 'skip',
    ) || [];

  const handleToggleQuestion = (questionId: string) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedQuestions(newSelected);
  };

  const handleDeleteQuestion = async (
    questionId: string,
    questionTitle: string,
  ) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir a questão "${questionTitle}"?\n\nEsta ação removerá a questão de todos os testes/trilhas que a contêm e não pode ser desfeita.`,
      )
    ) {
      return;
    }

    setDeletingQuestionId(questionId);
    try {
      await deleteQuestion({ id: questionId as Id<'questions'> });

      // Remove the question from selected questions if it was selected
      const newSelected = new Set(selectedQuestions);
      newSelected.delete(questionId);
      setSelectedQuestions(newSelected);

      toast({
        title: 'Sucesso',
        description: 'Questão excluída com sucesso!',
      });

      // Clear search to refresh results
      setSearchInput('');
    } catch (error) {
      console.error('Erro ao excluir questão:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a questão.',
        variant: 'destructive',
      });
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const handleSave = async () => {
    try {
      await onUpdateQuiz({
        name,
        description,
        category,
        questions: [...selectedQuestions],
        subcategory,
        displayOrder,
      });
      toast({
        title: 'Sucesso',
        description: 'Teste atualizado com sucesso!',
      });
      onOpenChange(false);
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o teste.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este teste?')) return;

    try {
      await onDeleteQuiz();
      toast({
        title: 'Sucesso',
        description: 'Teste excluído com sucesso!',
      });
      onOpenChange(false);
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o teste.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Editar Teste</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={event => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={event => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select
              value={category}
              onValueChange={(value: 'trilha' | 'simulado') =>
                setCategory(value)
              }
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trilha">Trilha</SelectItem>
                <SelectItem value="simulado">Simulado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategoria</Label>
            <Input
              id="subcategory"
              value={subcategory || ''}
              onChange={event => setSubcategory(event.target.value)}
              placeholder="Ex: TARO, TEOT, Simulados"
              disabled={category === 'trilha'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayOrder">Ordem de exibição</Label>
            <Input
              id="displayOrder"
              type="number"
              value={displayOrder?.toString() || ''}
              onChange={event => {
                const value = event.target.value;
                setDisplayOrder(value ? Number.parseInt(value, 10) : undefined);
              }}
              placeholder="Número para ordenação (menor vem primeiro)"
            />
          </div>
          <Input
            type="text"
            placeholder="Buscar questões por código ou título..."
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Digite um código ou parte do título para pesquisar questões. A busca
            será realizada após uma breve pausa na digitação.
          </p>
          <ScrollArea className="h-[400px] rounded-md border p-4">
            {debouncedSearchValue.trim() ? (
              searchResults.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-muted-foreground text-sm">
                    Nenhuma questão encontrada com este código
                  </p>
                </div>
              ) : (
                searchResults.map(question => (
                  <div
                    key={question._id}
                    className="mb-2 flex items-center justify-between space-x-2"
                  >
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={question._id}
                        checked={selectedQuestions.has(question._id)}
                        onCheckedChange={() =>
                          handleToggleQuestion(question._id)
                        }
                      />
                      <Label htmlFor={question._id} className="flex flex-col">
                        <span className="text-sm font-medium">
                          {question.questionCode || 'Sem código'}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {question.title}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          Tema: {question.theme?.name || 'Não especificado'}
                        </span>
                      </Label>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        handleDeleteQuestion(question._id, question.title)
                      }
                      disabled={deletingQuestionId === question._id}
                    >
                      {deletingQuestionId === question._id
                        ? 'Excluindo...'
                        : 'Excluir'}
                    </Button>
                  </div>
                ))
              )
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  Digite um código para pesquisar questões
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                Excluir Teste
              </Button>
              <span className="text-sm text-gray-500">
                {selectedQuestions.size} questões selecionadas
              </span>
            </div>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar Alterações</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
