'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTenantQuery } from '@/hooks/useTenantQuery';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { EditExamDialog } from './components/edit-quiz-dialog';

const formSchema = z
  .object({
    name: z.string().min(1, 'Nome é obrigatório'),
    description: z.string().min(1, 'Descrição é obrigatória'),
    category: z.enum(['trilha', 'simulado']),
    themeId: z.string().optional(),
    subthemeId: z.string().optional(),
    groupId: z.string().optional(),
    questions: z.array(z.string()).min(1, 'Selecione pelo menos uma questão'),
    isPublic: z.boolean().default(true),
    subcategory: z.string().optional(),
    displayOrder: z.number().optional(),
  })
  .refine(
    data => {
      // If category is 'trilha', themeId is required
      if (data.category === 'trilha' && !data.themeId) {
        return false;
      }
      return true;
    },
    {
      message: 'Tema é obrigatório para trilhas',
      path: ['themeId'],
    },
  );

export default function ManagePresetExams() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<
    | {
        id: string;
        name: string;
        description: string;
        category?: 'trilha' | 'simulado';
        subcategory?: string;
        displayOrder?: number;
      }
    | undefined
  >();

  // For question filtering in create form
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string>('all');

  // For quiz searching
  const [quizSearchInput, setQuizSearchInput] = useState('');
  const [quizSearchQuery, setQuizSearchQuery] = useState('');

  // For storing selected questions during creation
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(
    new Set(),
  );

  // Fetch data - only fetch themes for the creation form (tenant-aware)
  const themes = useTenantQuery(api.themes.list, {}) || [];

  // Use searchByName instead of list for quizzes - only when search is provided
  const presetQuizzes =
    useTenantQuery(
      api.presetQuizzes.searchByName,
      quizSearchQuery.trim() ? { name: quizSearchQuery, limit: 10 } : 'skip',
    ) || [];

  // Use the searchByCode function for code-based question search
  const questionSearchResults =
    useTenantQuery(
      api.questions.searchByCode,
      searchQuery.trim() ? { code: searchQuery, limit: 10 } : 'skip',
    ) || [];

  // Filter by theme if needed
  const filteredQuestions =
    selectedThemeFilter === 'all'
      ? questionSearchResults
      : questionSearchResults.filter(q => q.themeId === selectedThemeFilter);

  // Mutations
  const createPresetQuiz = useMutation(api.presetQuizzes.create);
  const updateQuiz = useMutation(api.presetQuizzes.updateQuiz);
  const deleteQuiz = useMutation(api.presetQuizzes.deleteQuiz);

  // Load the editing quiz details when needed
  const editingQuizDetails = useTenantQuery(
    api.presetQuizzes.get,
    editingExam ? { id: editingExam.id as Id<'presetQuizzes'> } : 'skip',
  );

  // Handle search functions
  const handleQuizSearch = () => {
    setQuizSearchQuery(quizSearchInput.trim());
  };

  const handleQuizClear = () => {
    setQuizSearchInput('');
    setQuizSearchQuery('');
  };

  const handleQuestionSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleQuestionClear = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  // Setup form with react-hook-form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'simulado',
      questions: [],
      subcategory: '',
      displayOrder: undefined,
    },
  });

  // Watch category value outside of JSX to avoid React Compiler warnings
  const watchedCategory = useWatch({ control: form.control, name: 'category' });

  // Watch the theme ID to filter questions
  const watchedThemeId = useWatch({ control: form.control, name: 'themeId' });

  // Reset subcategory when category changes to trilha
  useEffect(() => {
    if (watchedCategory === 'trilha') {
      form.setValue('subcategory', '');
    }
  }, [watchedCategory, form]);

  // Handle question selection toggle
  const handleToggleQuestion = (questionId: string) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedQuestions(newSelected);

    // Update form value
    form.setValue('questions', [...newSelected], {
      shouldValidate: true,
    });
  };

  // Form submission handler
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      // Create properly typed object
      const quizData: {
        name: string;
        description: string;
        category: 'trilha' | 'simulado';
        questions: Id<'questions'>[];
        isPublic: boolean;
        themeId?: Id<'themes'>;
        subthemeId?: Id<'subthemes'>;
        groupId?: Id<'groups'>;
        subcategory?: string;
        displayOrder?: number;
      } = {
        name: values.name,
        description: values.description,
        category: values.category,
        questions: values.questions as Id<'questions'>[],
        isPublic: values.isPublic,
        subcategory: values.subcategory || undefined,
        displayOrder: values.displayOrder || undefined,
      };

      // Only include theme-related fields if they have values
      if (values.themeId) {
        quizData.themeId = values.themeId as Id<'themes'>;
      }

      if (values.subthemeId) {
        quizData.subthemeId = values.subthemeId as Id<'subthemes'>;
      }

      if (values.groupId) {
        quizData.groupId = values.groupId as Id<'groups'>;
      }

      await createPresetQuiz(quizData);

      toast({
        title: 'Sucesso',
        description: 'Teste criado com sucesso!',
      });

      // Reset state and close dialog
      setOpen(false);
      form.reset();
      setSelectedQuestions(new Set());
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o teste. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  // Update quiz handler
  const handleUpdateExam = async (data: {
    name: string;
    description: string;
    category: 'trilha' | 'simulado';
    questions: string[];
    subcategory?: string;
    displayOrder?: number;
  }) => {
    if (!editingExam) return;

    try {
      await updateQuiz({
        quizId: editingExam.id as Id<'presetQuizzes'>,
        name: data.name,
        description: data.description,
        category: data.category,
        questions: data.questions as Id<'questions'>[],
        subcategory: data.subcategory,
        displayOrder: data.displayOrder,
      });

      toast({
        title: 'Sucesso',
        description: 'Teste atualizado com sucesso!',
      });
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o teste.',
        variant: 'destructive',
      });
    }
  };

  // Delete quiz handler
  const handleDeleteExam = async () => {
    if (!editingExam) return;

    try {
      await deleteQuiz({
        quizId: editingExam.id as Id<'presetQuizzes'>,
      });

      toast({
        title: 'Sucesso',
        description: 'Teste excluído com sucesso!',
      });
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o teste.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Trilhas e Simulados</CardTitle>
          <CardDescription>
            Crie e gerencie trilhas e simulados predefinidos para seus alunos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-between">
            <div className="flex max-w-md gap-2">
              <Input
                placeholder="Buscar testes por nome..."
                value={quizSearchInput}
                onChange={e => setQuizSearchInput(e.target.value)}
                className="w-full"
              />
              <Button onClick={handleQuizSearch}>Buscar</Button>
              {quizSearchInput && (
                <Button variant="ghost" onClick={handleQuizClear}>
                  Limpar
                </Button>
              )}
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Criar Novo Teste</Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Criar Novo Teste</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Descrição</FormLabel>
                              <FormControl>
                                <Textarea {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Categoria</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione uma categoria" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="trilha">Trilha</SelectItem>
                                  <SelectItem value="simulado">
                                    Simulado
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="themeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Tema{' '}
                                {watchedCategory === 'trilha' && (
                                  <span className="text-red-500">*</span>
                                )}
                              </FormLabel>
                              <Select
                                onValueChange={value => {
                                  field.onChange(value);
                                  setSelectedThemeFilter(value);
                                }}
                                defaultValue={field.value}
                                disabled={watchedCategory !== 'trilha'}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione um tema" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {themes.map(theme => (
                                    <SelectItem
                                      key={theme._id}
                                      value={theme._id}
                                    >
                                      {theme.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="questions"
                          render={() => (
                            <FormItem>
                              <FormLabel>Questões Selecionadas</FormLabel>
                              <FormControl>
                                <div className="rounded-md border p-2">
                                  <span className="text-muted-foreground text-sm">
                                    {selectedQuestions.size} questões
                                    selecionadas
                                  </span>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="subcategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Subcategoria</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Ex: TARO, TEOT, Simulados"
                                  value={field.value || ''}
                                  disabled={watchedCategory === 'trilha'}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="displayOrder"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ordem de exibição</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Número para ordenação (menor vem primeiro)"
                                  value={field.value?.toString() || ''}
                                  onChange={e => {
                                    const value = e.target.value;
                                    field.onChange(
                                      value
                                        ? Number.parseInt(value, 10)
                                        : undefined,
                                    );
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="searchQuestions">
                            Buscar Questões
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id="searchQuestions"
                              type="text"
                              placeholder="Buscar por código ou título da questão..."
                              value={searchInput}
                              onChange={e => setSearchInput(e.target.value)}
                            />
                            <Button onClick={handleQuestionSearch}>
                              Buscar
                            </Button>
                            {searchInput && (
                              <Button
                                variant="ghost"
                                onClick={handleQuestionClear}
                              >
                                Limpar
                              </Button>
                            )}
                          </div>
                          <p className="text-muted-foreground text-xs">
                            Digite um código ou parte do título e clique em
                            Buscar. Mostrando no máximo 10 resultados.
                          </p>
                        </div>

                        <ScrollArea className="h-[400px] rounded-md border p-4">
                          {filteredQuestions.length === 0 ? (
                            <div className="flex h-full items-center justify-center">
                              <p className="text-muted-foreground text-sm">
                                {searchQuery.trim()
                                  ? 'Nenhuma questão encontrada com este código'
                                  : 'Digite um código e clique em Buscar para pesquisar questões'}
                              </p>
                            </div>
                          ) : (
                            <div>
                              {filteredQuestions.map(question => (
                                <div
                                  key={question._id}
                                  className="mb-2 flex items-center space-x-2"
                                >
                                  <Checkbox
                                    id={question._id}
                                    checked={selectedQuestions.has(
                                      question._id,
                                    )}
                                    onCheckedChange={() =>
                                      handleToggleQuestion(question._id)
                                    }
                                  />
                                  <Label
                                    htmlFor={question._id}
                                    className="flex flex-col"
                                  >
                                    <span className="text-sm font-medium">
                                      {question.questionCode || 'Sem código'}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                      {question.title}
                                    </span>
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit">Criar Teste</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {quizSearchQuery.trim() ? (
              presetQuizzes.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  Nenhum teste encontrado com este nome
                </div>
              ) : (
                presetQuizzes.map(quiz => (
                  <Card key={quiz._id}>
                    <CardHeader>
                      <CardTitle>{quiz.name}</CardTitle>
                      <CardDescription>{quiz.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Subcategoria</TableHead>
                            <TableHead>Ordem</TableHead>
                            <TableHead>Questões</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>{quiz.name}</TableCell>
                            <TableCell>{quiz.description}</TableCell>
                            <TableCell>
                              {quiz.category === 'trilha'
                                ? 'Trilha'
                                : 'Simulado'}
                            </TableCell>
                            <TableCell>{quiz.subcategory || '-'}</TableCell>
                            <TableCell>
                              {quiz.displayOrder?.toString() || '-'}
                            </TableCell>
                            <TableCell>
                              {quiz.questions.length} questões
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setEditingExam({
                            id: quiz._id,
                            name: quiz.name,
                            description: quiz.description,
                            category: quiz.category,
                            subcategory: quiz.subcategory,
                            displayOrder: quiz.displayOrder,
                          })
                        }
                      >
                        Editar
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                Digite um nome e clique em Buscar para pesquisar testes
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {editingExam && editingQuizDetails && (
        <EditExamDialog
          open={!!editingExam}
          onOpenChange={open => !open && setEditingExam(undefined)}
          quiz={{
            id: editingExam.id,
            name: editingExam.name,
            description: editingExam.description,
            category: editingExam.category,
            subcategory: editingExam.subcategory,
            displayOrder: editingExam.displayOrder,
          }}
          presetQuizzes={[
            {
              _id: editingQuizDetails._id,
              name: editingQuizDetails.name,
              description: editingQuizDetails.description,
              category: editingQuizDetails.category,
              questions: editingQuizDetails.questions,
              subcategory: editingQuizDetails.subcategory,
              displayOrder: editingQuizDetails.displayOrder,
            },
          ]}
          onUpdateQuiz={handleUpdateExam}
          onDeleteQuiz={handleDeleteExam}
        />
      )}
    </div>
  );
}
