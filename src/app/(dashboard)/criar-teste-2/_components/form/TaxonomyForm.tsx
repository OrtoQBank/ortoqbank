'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { Filter, InfoIcon, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';
import { useTaxonomyData } from '../hooks/useTaxonomyData';
import { type TestFormData, testFormSchema } from '../schema';

interface FilterType {
  type: 'theme' | 'subtheme' | 'group';
  id: string;
  name: string;
  path: string[];
}

// Component for individual theme with question count
interface ThemeItemProps {
  theme: { _id: string; name: string };
  isSelected: boolean;
  isFilter: boolean;
  questionMode: 'all' | 'unanswered' | 'incorrect' | 'bookmarked';
  currentUserId?: string;
  onToggle: (themeId: string) => void;
}

function ThemeItem({
  theme,
  isSelected,
  isFilter,
  questionMode,
  currentUserId,
  onToggle,
}: ThemeItemProps) {
  const themeCount = useQuery(
    api.taxonomyAggregates.getLiveQuestionCountByTaxonomy,
    currentUserId
      ? {
          questionMode: questionMode,
          taxonomyIds: [theme._id] as Id<'taxonomy'>[],
          userId: currentUserId as Id<'users'>,
        }
      : 'skip',
  );

  return (
    <div
      className={cn(
        'relative flex cursor-pointer items-center space-x-3 rounded-lg border p-3 transition-colors',
        isSelected
          ? 'bg-primary/10 border-primary'
          : 'hover:bg-muted border-border',
        isFilter && 'ring-2 ring-blue-300',
      )}
      onClick={() => onToggle(theme._id)}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(theme._id)}
        className="pointer-events-none"
      />
      <div className="flex flex-1 items-center justify-between">
        <span className="font-medium">{theme.name}</span>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-gray-100 text-xs text-gray-600"
          >
            {themeCount === undefined ? '...' : themeCount}
          </Badge>
          {isFilter && (
            <Badge
              variant="secondary"
              className="bg-blue-100 text-xs text-blue-800"
            >
              Filtro
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// Component for individual subtheme with question count
interface SubthemeItemProps {
  subtheme: { _id: string; name: string };
  isSelected: boolean;
  isFilter: boolean;
  questionMode: 'all' | 'unanswered' | 'incorrect' | 'bookmarked';
  currentUserId?: string;
  onToggle: (subthemeId: string) => void;
}

function SubthemeItem({
  subtheme,
  isSelected,
  isFilter,
  questionMode,
  currentUserId,
  onToggle,
}: SubthemeItemProps) {
  const subthemeCount = useQuery(
    api.taxonomyAggregates.getLiveQuestionCountByTaxonomy,
    currentUserId
      ? {
          questionMode: questionMode,
          taxonomyIds: [subtheme._id] as Id<'taxonomy'>[],
          userId: currentUserId as Id<'users'>,
        }
      : 'skip',
  );

  return (
    <div
      className="flex cursor-pointer items-center space-x-2"
      onClick={() => onToggle(subtheme._id)}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(subtheme._id)}
        className="pointer-events-none"
      />
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium">{subtheme.name}</span>
        <Badge variant="outline" className="bg-gray-100 text-xs text-gray-600">
          {subthemeCount === undefined ? '...' : subthemeCount}
        </Badge>
        {isFilter && (
          <Badge
            variant="secondary"
            className="bg-green-100 text-xs text-green-800"
          >
            Filtro
          </Badge>
        )}
      </div>
    </div>
  );
}

// Component for individual group with question count
interface GroupItemProps {
  group: { _id: string; name: string };
  isSelected: boolean;
  isFilter: boolean;
  questionMode: 'all' | 'unanswered' | 'incorrect' | 'bookmarked';
  currentUserId?: string;
  onToggle: (groupId: string) => void;
}

function GroupItem({
  group,
  isSelected,
  isFilter,
  questionMode,
  currentUserId,
  onToggle,
}: GroupItemProps) {
  const groupCount = useQuery(
    api.taxonomyAggregates.getLiveQuestionCountByTaxonomy,
    currentUserId
      ? {
          questionMode: questionMode,
          taxonomyIds: [group._id] as Id<'taxonomy'>[],
          userId: currentUserId as Id<'users'>,
        }
      : 'skip',
  );

  return (
    <div
      className="flex cursor-pointer items-center space-x-2"
      onClick={() => onToggle(group._id)}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(group._id)}
        className="pointer-events-none"
      />
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium">{group.name}</span>
        <Badge variant="outline" className="bg-gray-100 text-xs text-gray-600">
          {groupCount === undefined ? '...' : groupCount}
        </Badge>
        {isFilter && (
          <Badge
            variant="secondary"
            className="bg-purple-100 text-xs text-purple-800"
          >
            Filtro
          </Badge>
        )}
      </div>
    </div>
  );
}

// Map UI question modes to API question modes
const mapQuestionMode = (
  mode: string,
): 'all' | 'unanswered' | 'incorrect' | 'bookmarked' => {
  switch (mode) {
    case 'bookmarked': {
      return 'bookmarked';
    }
    case 'unanswered': {
      return 'unanswered';
    }
    case 'incorrect': {
      return 'incorrect';
    }
    default: {
      return 'all';
    }
  }
};

export default function TaxonomyForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testName, setTestName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterType[]>([]);

  // Use Sets for stable state management like in the example
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [selectedSubthemes, setSelectedSubthemes] = useState<Set<string>>(
    new Set(),
  );
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  // Simplified state management without form
  const [testMode, setTestMode] = useState<'study' | 'exam'>('study');
  const [questionMode, setQuestionMode] = useState<
    'all' | 'unanswered' | 'incorrect' | 'bookmarked'
  >('all');
  const [numQuestions, setNumQuestions] = useState(30);

  // Use new taxonomy data hook
  const {
    hierarchicalData,
    getSubthemesForTheme,
    getGroupsForSubtheme,
    isLoading,
  } = useTaxonomyData();

  // Get current user for user-specific filtering
  const currentUser = useQuery(api.users.current);

  // Get live question count using applied filters (only the actual filters, not all selections)
  const questionCount = useQuery(
    api.taxonomyAggregates.getLiveQuestionCountByTaxonomy,
    {
      questionMode: mapQuestionMode(questionMode),
      taxonomyIds: appliedFilters.map(filter => filter.id) as Id<'taxonomy'>[],
      userId: currentUser?._id,
    },
  );

  const createCustomQuiz = useMutation(api.customQuizzes.createWithTaxonomy);

  // Calculate applied filters based on selections (using stable Set-based pattern)
  useEffect(() => {
    if (!hierarchicalData) return;

    const newFilters: FilterType[] = [];

    // For each selected theme
    selectedThemes.forEach(themeId => {
      const theme = hierarchicalData.themes?.find(t => t._id === themeId);
      if (!theme) return;

      const themeSubthemes = getSubthemesForTheme(themeId as Id<'taxonomy'>);
      const selectedSubthemesInTheme = themeSubthemes.filter(subtheme =>
        selectedSubthemes.has(subtheme._id),
      );

      if (selectedSubthemesInTheme.length === 0) {
        // No subthemes selected in this theme, so theme becomes a filter
        newFilters.push({
          type: 'theme',
          id: themeId,
          name: theme.name,
          path: [theme.name],
        });
      } else {
        // Some subthemes are selected, check each subtheme
        selectedSubthemesInTheme.forEach(subtheme => {
          const subthemeGroups = getGroupsForSubtheme(
            subtheme._id as Id<'taxonomy'>,
          );
          const selectedGroupsInSubtheme = subthemeGroups.filter(group =>
            selectedGroups.has(group._id),
          );

          if (selectedGroupsInSubtheme.length === 0) {
            // No groups selected in this subtheme, so subtheme becomes a filter
            newFilters.push({
              type: 'subtheme',
              id: subtheme._id,
              name: subtheme.name,
              path: [theme.name, subtheme.name],
            });
          } else {
            // Some groups are selected, each group becomes a filter
            selectedGroupsInSubtheme.forEach(group => {
              newFilters.push({
                type: 'group',
                id: group._id,
                name: group.name,
                path: [theme.name, subtheme.name, group.name],
              });
            });
          }
        });
      }
    });

    setAppliedFilters(newFilters);
  }, [selectedThemes, selectedSubthemes, selectedGroups, hierarchicalData]);

  // Helper functions to determine if an item will be a filter
  const isThemeFilter = (themeId: string) => {
    const themeSubthemes = getSubthemesForTheme(themeId as Id<'taxonomy'>);
    const selectedSubthemesInTheme = themeSubthemes.filter(subtheme =>
      selectedSubthemes.has(subtheme._id),
    );
    return selectedThemes.has(themeId) && selectedSubthemesInTheme.length === 0;
  };

  const isSubthemeFilter = (subthemeId: string) => {
    const subthemeGroups = getGroupsForSubtheme(subthemeId as Id<'taxonomy'>);
    const selectedGroupsInSubtheme = subthemeGroups.filter(group =>
      selectedGroups.has(group._id),
    );
    return (
      selectedSubthemes.has(subthemeId) && selectedGroupsInSubtheme.length === 0
    );
  };

  const isGroupFilter = (groupId: string) => {
    return selectedGroups.has(groupId);
  };

  const clearAllFilters = () => {
    setSelectedThemes(new Set());
    setSelectedSubthemes(new Set());
    setSelectedGroups(new Set());
  };

  const getFilterDisplay = (filter: FilterType) => {
    return filter.path.join(' → ');
  };

  const getFilterBadgeColor = (filter: FilterType) => {
    switch (filter.type) {
      case 'theme': {
        return 'bg-blue-100 text-blue-800 border-blue-200';
      }
      case 'subtheme': {
        return 'bg-green-100 text-green-800 border-green-200';
      }
      case 'group': {
        return 'bg-purple-100 text-purple-800 border-purple-200';
      }
      default: {
        return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    }
  };

  const toggleTheme = (themeId: string) => {
    const newSelectedThemes = new Set(selectedThemes);
    if (newSelectedThemes.has(themeId)) {
      newSelectedThemes.delete(themeId);
      // Remove associated subthemes and groups
      const newSelectedSubthemes = new Set(selectedSubthemes);
      const newSelectedGroups = new Set(selectedGroups);
      const subthemesToRemove = getSubthemesForTheme(themeId as Id<'taxonomy'>);
      subthemesToRemove.forEach(subtheme => {
        newSelectedSubthemes.delete(subtheme._id);
        const groupsToRemove = getGroupsForSubtheme(
          subtheme._id as Id<'taxonomy'>,
        );
        groupsToRemove.forEach(group => {
          newSelectedGroups.delete(group._id);
        });
      });
      setSelectedSubthemes(newSelectedSubthemes);
      setSelectedGroups(newSelectedGroups);
    } else {
      newSelectedThemes.add(themeId);
    }
    setSelectedThemes(newSelectedThemes);
  };

  const toggleSubtheme = (subthemeId: string) => {
    const newSelectedSubthemes = new Set(selectedSubthemes);
    if (newSelectedSubthemes.has(subthemeId)) {
      newSelectedSubthemes.delete(subthemeId);
      // Remove associated groups
      const newSelectedGroups = new Set(selectedGroups);
      const groupsToRemove = getGroupsForSubtheme(subthemeId as Id<'taxonomy'>);
      groupsToRemove.forEach(group => {
        newSelectedGroups.delete(group._id);
      });
      setSelectedGroups(newSelectedGroups);
    } else {
      newSelectedSubthemes.add(subthemeId);
    }
    setSelectedSubthemes(newSelectedSubthemes);
  };

  const toggleGroup = (groupId: string) => {
    const newSelectedGroups = new Set(selectedGroups);
    if (newSelectedGroups.has(groupId)) {
      newSelectedGroups.delete(groupId);
    } else {
      newSelectedGroups.add(groupId);
    }
    setSelectedGroups(newSelectedGroups);
  };

  const onSubmit = async () => {
    if (!testName.trim()) {
      setShowNameInput(true);
      return;
    }

    try {
      setIsSubmitting(true);

      // Use applied filters instead of all selections for quiz creation
      const themeFilters = appliedFilters
        .filter(f => f.type === 'theme')
        .map(f => f.id);
      const subthemeFilters = appliedFilters
        .filter(f => f.type === 'subtheme')
        .map(f => f.id);
      const groupFilters = appliedFilters
        .filter(f => f.type === 'group')
        .map(f => f.id);

      const result = await createCustomQuiz({
        name: testName,
        description: `Teste criado em ${new Date().toLocaleDateString()}`,
        testMode: testMode,
        questionMode: mapQuestionMode(questionMode),
        numQuestions: numQuestions,
        selectedThemes: themeFilters as Id<'taxonomy'>[],
        selectedSubthemes: subthemeFilters as Id<'taxonomy'>[],
        selectedGroups: groupFilters as Id<'taxonomy'>[],
      });

      if (result.quizId) {
        router.push(`/criar-teste/${result.quizId}`);
      }
    } catch (error) {
      console.error('Erro ao criar quiz:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando filtros...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {/* Test Name Input Modal */}
      {showNameInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Nome do Teste</h3>
              <Input
                placeholder="Digite o nome do seu teste"
                value={testName}
                onChange={e => setTestName(e.target.value)}
                className="mb-4"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNameInput(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={!testName.trim()}
                  onClick={onSubmit}
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                >
                  Criar Teste
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="space-y-12 p-4 sm:space-y-14 sm:p-6">
          {/* Test Mode Section */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium">Modo</h3>
              <Popover>
                <PopoverTrigger asChild>
                  <InfoIcon className="text-muted-foreground h-4 w-4 cursor-pointer" />
                </PopoverTrigger>
                <PopoverContent className="max-w-xs border border-black">
                  <p>
                    Modo Simulado simula condições de prova, enquanto Modo
                    Estudo permite revisar respostas imediatamente.
                  </p>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-start">
              <Tabs
                value={testMode}
                onValueChange={value => setTestMode(value as 'study' | 'exam')}
              >
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger
                    value="exam"
                    className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                  >
                    Simulado
                  </TabsTrigger>
                  <TabsTrigger
                    value="study"
                    className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                  >
                    Estudo
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Question Mode Section */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium">Questões</h3>
              <Popover>
                <PopoverTrigger asChild>
                  <InfoIcon className="text-muted-foreground h-4 w-4 cursor-pointer" />
                </PopoverTrigger>
                <PopoverContent className="max-w-xs border border-black">
                  <p>
                    Filtre as questões por status: Todas, Não respondidas,
                    Incorretas ou Marcadas.
                  </p>
                </PopoverContent>
              </Popover>
            </div>
            <RadioGroup
              value={questionMode}
              onValueChange={(
                value: 'all' | 'unanswered' | 'incorrect' | 'bookmarked',
              ) => setQuestionMode(value)}
              className="flex flex-wrap gap-4"
            >
              {[
                { id: 'all', label: 'Todas' },
                { id: 'unanswered', label: 'Não respondidas' },
                { id: 'incorrect', label: 'Incorretas' },
                { id: 'bookmarked', label: 'Marcadas' },
              ].map(({ id, label }) => (
                <div key={id} className="flex items-center gap-2">
                  <RadioGroupItem id={id} value={id} />
                  <Label htmlFor={id} className="flex items-center gap-2">
                    <span>{label}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Themes Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Temas</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {hierarchicalData?.themes?.map(theme => (
                <ThemeItem
                  key={theme._id}
                  theme={theme}
                  isSelected={selectedThemes.has(theme._id)}
                  isFilter={isThemeFilter(theme._id)}
                  questionMode={mapQuestionMode(questionMode)}
                  currentUserId={currentUser?._id}
                  onToggle={toggleTheme}
                />
              ))}
            </div>
          </div>

          {/* Subthemes Section */}
          {selectedThemes.size > 0 && (
            <div className="border-primary/20 space-y-3 border-l-2 pl-4">
              <Label className="text-base font-semibold">Subtemas</Label>
              {[...selectedThemes].map(themeId => {
                const theme = hierarchicalData?.themes?.find(
                  t => t._id === themeId,
                );
                const subthemes = getSubthemesForTheme(
                  themeId as Id<'taxonomy'>,
                );

                if (!theme || subthemes.length === 0) return;

                return (
                  <div key={themeId} className="space-y-2">
                    <Label className="text-muted-foreground text-sm">
                      {theme.name}
                    </Label>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {subthemes.map(subtheme => (
                        <SubthemeItem
                          key={subtheme._id}
                          subtheme={subtheme}
                          isSelected={selectedSubthemes.has(subtheme._id)}
                          isFilter={isSubthemeFilter(subtheme._id)}
                          questionMode={mapQuestionMode(questionMode)}
                          currentUserId={currentUser?._id}
                          onToggle={toggleSubtheme}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Groups Section */}
          {selectedSubthemes.size > 0 && (
            <div className="border-primary/20 space-y-3 border-l-2 pl-8">
              <Label className="text-base font-semibold">Grupos</Label>
              {[...selectedThemes].map(themeId => {
                const theme = hierarchicalData?.themes?.find(
                  t => t._id === themeId,
                );
                if (!theme) return;

                const subthemes = getSubthemesForTheme(
                  themeId as Id<'taxonomy'>,
                );
                const selectedSubthemesInTheme = subthemes.filter(subtheme =>
                  selectedSubthemes.has(subtheme._id),
                );

                if (selectedSubthemesInTheme.length === 0) return;

                return (
                  <div key={themeId} className="space-y-2">
                    {selectedSubthemesInTheme.map(subtheme => {
                      const groups = getGroupsForSubtheme(
                        subtheme._id as Id<'taxonomy'>,
                      );
                      if (groups.length === 0) return;

                      return (
                        <div
                          key={`${themeId}-${subtheme._id}`}
                          className="mb-4 space-y-2"
                        >
                          <Label className="text-muted-foreground text-sm">
                            {theme.name} → {subtheme.name}
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {groups.map(group => (
                              <GroupItem
                                key={`${themeId}-${subtheme._id}-${group._id}`}
                                group={group}
                                isSelected={selectedGroups.has(group._id)}
                                isFilter={isGroupFilter(group._id)}
                                questionMode={mapQuestionMode(questionMode)}
                                currentUserId={currentUser?._id}
                                onToggle={toggleGroup}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Applied Filters */}
          {appliedFilters.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Filtros Aplicados
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Limpar Todos
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {appliedFilters.map((filter, index) => (
                  <Badge
                    key={index}
                    className={cn(
                      'flex items-center gap-1 py-1 pr-1',
                      getFilterBadgeColor(filter),
                    )}
                  >
                    <span className="text-xs">{getFilterDisplay(filter)}</span>
                    <span className="text-xs opacity-60">({filter.type})</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Question Count Section */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium">
                Quantidade Máxima de Questões
              </h3>
              <Popover>
                <PopoverTrigger asChild>
                  <InfoIcon className="text-muted-foreground h-4 w-4 cursor-pointer" />
                </PopoverTrigger>
                <PopoverContent className="max-w-xs border border-black">
                  <p>
                    Defina quantas questões você quer no seu teste (máximo 120).
                  </p>
                </PopoverContent>
              </Popover>
            </div>
            <Input
              type="number"
              min="1"
              max="120"
              value={numQuestions}
              onChange={e =>
                setNumQuestions(Number.parseInt(e.target.value) || 30)
              }
              className="w-32"
            />
          </div>

          {/* Available Questions Info */}
          <div className="rounded-lg bg-blue-50 p-4">
            <h4 className="mb-2 font-medium text-blue-700">
              Questões Disponíveis
            </h4>
            <div className="text-blue-600">
              Há{' '}
              <strong>
                {questionCount === undefined ? '...' : questionCount}
              </strong>{' '}
              questões disponíveis com os critérios selecionados.
              {questionCount !== undefined && numQuestions > questionCount && (
                <div className="mt-2 text-orange-600">
                  <strong>Nota:</strong> Você solicitou {numQuestions} questões,
                  mas apenas {questionCount} estão disponíveis.
                </div>
              )}
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setShowNameInput(true)}
            className="w-full bg-blue-500 hover:bg-blue-600"
            disabled={isSubmitting || !questionCount || questionCount === 0}
          >
            {isSubmitting ? 'Gerando seu teste...' : 'Gerar Teste'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
