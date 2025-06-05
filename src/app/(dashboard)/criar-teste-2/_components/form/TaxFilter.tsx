'use client';

import { useQuery } from 'convex-helpers/react/cache/hooks';
import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { api } from '../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../convex/_generated/dataModel';
import type { TaxonomyItem } from './utils/taxonomyProcessor';

export default function TaxFilter() {
  const taxonomyData = useQuery(api.taxonomy.getHierarchicalData);
  const { watch, setValue } = useFormContext();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Get current selection from form
  const selection: TaxonomyItem[] = watch('taxonomySelection') || [];

  // Get selected themes to show their subthemes
  const selectedThemes = selection.filter(item => item.type === 'theme');
  const selectedSubthemes = selection.filter(item => item.type === 'subtheme');
  const selectedGroups = selection.filter(item => item.type === 'group');

  // Helper to get the most specific selections for display
  const getMostSpecificSelections = (): TaxonomyItem[] => {
    if (!taxonomyData || !Array.isArray(taxonomyData)) return [];

    const result: TaxonomyItem[] = [];
    const processedIds = new Set<Id<'taxonomy'>>();

    // Add all groups (most specific)
    selectedGroups.forEach(group => {
      result.push(group);
      processedIds.add(group.id);
    });

    // Add subthemes that don't have groups selected
    selectedSubthemes.forEach(subtheme => {
      let hasSelectedGroups = false;
      taxonomyData.forEach((theme: any) => {
        if (theme.children) {
          const foundSubtheme = theme.children.find(
            (s: any) => s._id === subtheme.id,
          );
          if (foundSubtheme?.children) {
            hasSelectedGroups = foundSubtheme.children.some((g: any) =>
              selectedGroups.some(group => group.id === g._id),
            );
          }
        }
      });

      if (!hasSelectedGroups && !processedIds.has(subtheme.id)) {
        result.push(subtheme);
        processedIds.add(subtheme.id);
      }
    });

    // Add themes that don't have children selected
    selectedThemes.forEach(theme => {
      const hasSelectedChildren = [
        ...selectedSubthemes,
        ...selectedGroups,
      ].some(item => {
        if (item.type === 'subtheme') {
          const themeData = taxonomyData.find((t: any) => t._id === theme.id);
          return themeData?.children?.some((s: any) => s._id === item.id);
        }
        if (item.type === 'group') {
          const themeData = taxonomyData.find((t: any) => t._id === theme.id);
          return themeData?.children?.some((s: any) =>
            s.children?.some((g: any) => g._id === item.id),
          );
        }
        return false;
      });

      if (!hasSelectedChildren && !processedIds.has(theme.id)) {
        result.push(theme);
        processedIds.add(theme.id);
      }
    });

    return result;
  };

  const mostSpecificSelections = getMostSpecificSelections();

  // Get subthemes to display (from selected themes or already selected subthemes/groups)
  const subthemesToShow = useMemo(() => {
    if (!taxonomyData || !Array.isArray(taxonomyData)) return [];

    const result: any[] = [];

    // Add subthemes from selected themes
    selectedThemes.forEach(theme => {
      const themeData = taxonomyData.find((t: any) => t._id === theme.id);
      if (themeData?.children) {
        themeData.children.forEach((subtheme: any) => {
          result.push({
            ...subtheme,
            themeName: themeData.name,
            themeId: themeData._id,
          });
        });
      }
    });

    // Add subthemes that are already selected (even if theme not selected)
    [...selectedSubthemes, ...selectedGroups].forEach(item => {
      taxonomyData.forEach((theme: any) => {
        if (theme.children) {
          theme.children.forEach((subtheme: any) => {
            if (item.type === 'subtheme' && subtheme._id === item.id) {
              if (!result.some(s => s._id === subtheme._id)) {
                result.push({
                  ...subtheme,
                  themeName: theme.name,
                  themeId: theme._id,
                });
              }
            } else if (
              item.type === 'group' &&
              subtheme.children?.some((g: any) => g._id === item.id) &&
              !result.some(s => s._id === subtheme._id)
            ) {
              result.push({
                ...subtheme,
                themeName: theme.name,
                themeId: theme._id,
              });
            }
          });
        }
      });
    });

    return result;
  }, [taxonomyData, selectedThemes, selectedSubthemes, selectedGroups]);

  // Handle loading state
  if (!taxonomyData) {
    return (
      <CardContent>
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground text-sm">
            Carregando taxonomia...
          </div>
        </div>
      </CardContent>
    );
  }

  // Handle empty data
  if (!Array.isArray(taxonomyData) || taxonomyData.length === 0) {
    return (
      <CardContent>
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground text-sm">
            Nenhum tema encontrado
          </div>
        </div>
      </CardContent>
    );
  }

  const toggleSelection = (
    id: Id<'taxonomy'>,
    name: string,
    type: 'theme' | 'subtheme' | 'group',
  ) => {
    const newSelection: TaxonomyItem[] = [...selection];
    const existingIndex = newSelection.findIndex(
      (item: TaxonomyItem) => item.id === id,
    );

    if (existingIndex === -1) {
      // Add if not selected
      const newItem: TaxonomyItem = { id, name, type };
      newSelection.push(newItem);
    } else {
      // Remove if already selected
      newSelection.splice(existingIndex, 1);

      // When removing a theme, also remove its subthemes and groups
      if (type === 'theme') {
        const filteredSelection = newSelection.filter((item: TaxonomyItem) => {
          if (item.type === 'subtheme') {
            const theme = taxonomyData.find((t: any) => t._id === id);
            return !theme?.children?.some((s: any) => s._id === item.id);
          }
          if (item.type === 'group') {
            const theme = taxonomyData.find((t: any) => t._id === id);
            return !theme?.children?.some((s: any) =>
              s.children?.some((g: any) => g._id === item.id),
            );
          }
          return true;
        });
        setValue('taxonomySelection', filteredSelection, { shouldDirty: true });
        return;
      }

      // When removing a subtheme, also remove its groups
      if (type === 'subtheme') {
        const filteredSelection = newSelection.filter((item: TaxonomyItem) => {
          if (item.type === 'group') {
            let subthemeData: any = null;
            taxonomyData.forEach((theme: any) => {
              if (theme.children) {
                const foundSubtheme = theme.children.find(
                  (s: any) => s._id === id,
                );
                if (foundSubtheme) {
                  subthemeData = foundSubtheme;
                }
              }
            });
            return !subthemeData?.children?.some((g: any) => g._id === item.id);
          }
          return true;
        });
        setValue('taxonomySelection', filteredSelection, { shouldDirty: true });
        return;
      }
    }

    setValue('taxonomySelection', newSelection, { shouldDirty: true });
  };

  const isSelected = (id: Id<'taxonomy'>) => {
    return selection.some((item: TaxonomyItem) => item.id === id);
  };

  const toggleGroupExpansion = (subthemeId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(subthemeId)) {
      newExpanded.delete(subthemeId);
    } else {
      newExpanded.add(subthemeId);
    }
    setExpandedGroups(newExpanded);
  };

  const clearAll = () => {
    setValue('taxonomySelection', [], { shouldDirty: true });
  };

  return (
    <CardContent className="space-y-6">
      {/* Temas Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-base font-semibold">Temas</Label>
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200">
            <span className="text-xs text-gray-600">?</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {taxonomyData.map((theme: any) => {
            const selected = isSelected(theme._id);
            return (
              <button
                key={theme._id}
                type="button"
                onClick={() => toggleSelection(theme._id, theme.name, 'theme')}
                className={`rounded px-3 py-2 text-left text-sm font-medium transition-colors ${
                  selected
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {theme.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtemas Section */}
      {subthemesToShow.length > 0 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">Subtemas</Label>
          <div className="space-y-4">
            {/* Group subthemes by theme */}
            {Object.entries(
              subthemesToShow.reduce((acc: any, subtheme: any) => {
                if (!acc[subtheme.themeName]) {
                  acc[subtheme.themeName] = [];
                }
                acc[subtheme.themeName].push(subtheme);
                return acc;
              }, {}),
            ).map(([themeName, subthemes]: [string, any]) => (
              <div key={themeName} className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">
                  {themeName}
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(subthemes as any[]).map((subtheme: any) => (
                    <div key={subtheme._id} className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={isSelected(subtheme._id)}
                          onCheckedChange={() =>
                            toggleSelection(
                              subtheme._id,
                              subtheme.name,
                              'subtheme',
                            )
                          }
                        />
                        <Label className="flex-1 cursor-pointer text-sm">
                          {subtheme.name}
                        </Label>
                        {subtheme.children && subtheme.children.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => toggleGroupExpansion(subtheme._id)}
                            className="h-4 w-4 p-0"
                          >
                            <ChevronRight
                              className={`h-3 w-3 transition-transform ${
                                expandedGroups.has(subtheme._id)
                                  ? 'rotate-90'
                                  : ''
                              }`}
                            />
                          </Button>
                        )}
                      </div>

                      {/* Groups */}
                      {expandedGroups.has(subtheme._id) &&
                        subtheme.children && (
                          <div className="ml-6 space-y-1">
                            {subtheme.children.map((group: any) => (
                              <div
                                key={group._id}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  checked={isSelected(group._id)}
                                  onCheckedChange={() =>
                                    toggleSelection(
                                      group._id,
                                      group.name,
                                      'group',
                                    )
                                  }
                                />
                                <Label className="cursor-pointer text-sm">
                                  {group.name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Selection Summary */}
      {mostSpecificSelections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Escopo Ativo ({mostSpecificSelections.length}{' '}
              {mostSpecificSelections.length === 1 ? 'filtro' : 'filtros'}):
            </Label>
            <Button variant="ghost" size="sm" type="button" onClick={clearAll}>
              Limpar Tudo
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {mostSpecificSelections.map((item: TaxonomyItem) => (
              <Badge key={item.id} variant="outline" className="text-xs">
                {item.name}
                <span className="text-muted-foreground ml-1">
                  (
                  {item.type === 'theme'
                    ? '🎯'
                    : item.type === 'subtheme'
                      ? '📂'
                      : '📄'}
                  )
                </span>
              </Badge>
            ))}
          </div>
          {mostSpecificSelections.length !== selection.length && (
            <p className="text-muted-foreground text-xs">
              {selection.length - mostSpecificSelections.length} seleção(ões) de
              nível superior estão incluídas automaticamente
            </p>
          )}
        </div>
      )}

      {/* Helper text */}
      {selection.length === 0 && (
        <div className="text-muted-foreground py-4 text-center text-sm">
          👆 Selecione temas para começar a filtrar questões
        </div>
      )}
    </CardContent>
  );
}
