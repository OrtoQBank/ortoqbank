'use client';

import { useQuery } from 'convex-helpers/react/cache/hooks';
import { ChevronRight, Minus } from 'lucide-react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { api } from '../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../convex/_generated/dataModel';
import type { TaxonomyItem } from './utils/taxonomyProcessor';

// Utility functions to reduce duplication
const taxonomyUtils = {
  // Find subtheme by ID and return its groups
  findSubthemeGroups: (taxonomyData: any[], subthemeId: Id<'taxonomy'>) => {
    for (const theme of taxonomyData) {
      if (theme.children) {
        const subtheme = theme.children.find((s: any) => s._id === subthemeId);
        if (subtheme?.children) return subtheme.children;
      }
    }
    return [];
  },

  // Find which subtheme a group belongs to
  findParentSubtheme: (taxonomyData: any[], groupId: Id<'taxonomy'>) => {
    for (const theme of taxonomyData) {
      if (theme.children) {
        for (const subtheme of theme.children) {
          if (subtheme.children?.some((g: any) => g._id === groupId)) {
            return subtheme;
          }
        }
      }
    }
    return null;
  },

  // Check if a subtheme has a specific group
  subthemeHasGroup: (
    taxonomyData: any[],
    subthemeId: Id<'taxonomy'>,
    groupId: Id<'taxonomy'>,
  ) => {
    const groups = taxonomyUtils.findSubthemeGroups(taxonomyData, subthemeId);
    return groups.some((g: any) => g._id === groupId);
  },

  // Get all groups from a subtheme with their selection status
  getSubthemeGroupsWithStatus: (
    taxonomyData: any[],
    subthemeId: Id<'taxonomy'>,
    isSelected: (id: Id<'taxonomy'>) => boolean,
  ) => {
    const groups = taxonomyUtils.findSubthemeGroups(taxonomyData, subthemeId);
    return groups.map((group: any) => ({
      ...group,
      isSelected: isSelected(group._id),
    }));
  },
};

const selectionUtils = {
  // Filter selection by type
  byType: (selection: TaxonomyItem[], type: TaxonomyItem['type']) =>
    selection.filter(item => item.type === type),

  // Check if item is selected
  isSelected: (selection: TaxonomyItem[], id: Id<'taxonomy'>) =>
    selection.some(item => item.id === id),

  // Remove items from selection by type and parent ID
  removeByParent: (
    selection: TaxonomyItem[],
    taxonomyData: any[],
    parentId: Id<'taxonomy'>,
    parentType: 'theme' | 'subtheme',
  ) => {
    return selection.filter(item => {
      if (parentType === 'theme') {
        if (item.type === 'subtheme') {
          const theme = taxonomyData.find((t: any) => t._id === parentId);
          return !theme?.children?.some((s: any) => s._id === item.id);
        }
        if (item.type === 'group') {
          const theme = taxonomyData.find((t: any) => t._id === parentId);
          return !theme?.children?.some((s: any) =>
            s.children?.some((g: any) => g._id === item.id),
          );
        }
      } else if (parentType === 'subtheme' && item.type === 'group') {
        return !taxonomyUtils.subthemeHasGroup(taxonomyData, parentId, item.id);
      }
      return true;
    });
  },
};

export default function TaxFilter() {
  const taxonomyData = useQuery(api.taxonomy.getHierarchicalData);
  const { watch, setValue } = useFormContext();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const selection: TaxonomyItem[] = watch('taxonomySelection') || [];

  // Derived state using utility functions
  const selectedThemes = selectionUtils.byType(selection, 'theme');
  const selectedSubthemes = selectionUtils.byType(selection, 'subtheme');
  const selectedGroups = selectionUtils.byType(selection, 'group');

  const isSelected = (id: Id<'taxonomy'>) =>
    selectionUtils.isSelected(selection, id);

  // Check if subtheme is partially selected
  const isSubthemePartial = (subthemeId: Id<'taxonomy'>) => {
    if (!taxonomyData) return false;

    const groupsWithStatus = taxonomyUtils.getSubthemeGroupsWithStatus(
      taxonomyData,
      subthemeId,
      isSelected,
    );

    if (groupsWithStatus.length === 0) return false;

    const selectedCount = groupsWithStatus.filter(
      (g: any) => g.isSelected,
    ).length;
    const isSubthemeSelected = isSelected(subthemeId);

    // Show partial state in two cases:
    // 1. Subtheme is selected but not all groups are selected
    // 2. Subtheme is not selected but some groups are selected
    return isSubthemeSelected
      ? selectedCount < groupsWithStatus.length // Case 1: missing some groups
      : selectedCount > 0; // Case 2: has some groups selected
  };

  // Get subthemes to show (simplified)
  const getSubthemesToShow = () => {
    if (!taxonomyData) return [];

    const result: any[] = [];
    const processedIds = new Set();

    // Add from selected themes
    selectedThemes.forEach(theme => {
      const themeData = taxonomyData.find((t: any) => t._id === theme.id);
      themeData?.children?.forEach((subtheme: any) => {
        if (!processedIds.has(subtheme._id)) {
          result.push({
            ...subtheme,
            themeName: themeData.name,
            themeId: themeData._id,
          });
          processedIds.add(subtheme._id);
        }
      });
    });

    // Add from selected subthemes/groups
    [...selectedSubthemes, ...selectedGroups].forEach(item => {
      taxonomyData.forEach((theme: any) => {
        theme.children?.forEach((subtheme: any) => {
          const shouldAdd =
            (item.type === 'subtheme' && subtheme._id === item.id) ||
            (item.type === 'group' &&
              subtheme.children?.some((g: any) => g._id === item.id));

          if (shouldAdd && !processedIds.has(subtheme._id)) {
            result.push({
              ...subtheme,
              themeName: theme.name,
              themeId: theme._id,
            });
            processedIds.add(subtheme._id);
          }
        });
      });
    });

    return result;
  };

  // Get selections for escopo ativo (simplified)
  const getMostSpecificSelections = (): (TaxonomyItem & {
    isExcluded?: boolean;
  })[] => {
    if (!taxonomyData) return selection;

    const result: (TaxonomyItem & { isExcluded?: boolean })[] = [];
    const processedIds = new Set<Id<'taxonomy'>>();

    // Add standalone groups
    selectedGroups.forEach(group => {
      const hasParentSubtheme = selectedSubthemes.some(subtheme =>
        taxonomyUtils.subthemeHasGroup(taxonomyData, subtheme.id, group.id),
      );
      if (!hasParentSubtheme && !processedIds.has(group.id)) {
        result.push(group);
        processedIds.add(group.id);
      }
    });

    // Add subthemes with partial state handling
    selectedSubthemes.forEach(subtheme => {
      if (processedIds.has(subtheme.id)) return;

      const isPartial = isSubthemePartial(subtheme.id);
      result.push({ ...subtheme, isExcluded: false });
      processedIds.add(subtheme.id);

      if (isPartial) {
        const groups = taxonomyUtils.findSubthemeGroups(
          taxonomyData,
          subtheme.id,
        );
        groups.forEach((group: any) => {
          if (!processedIds.has(group._id) && !isSelected(group._id)) {
            result.push({
              id: group._id,
              name: group.name,
              type: 'group',
              isExcluded: true,
            });
            processedIds.add(group._id);
          }
        });
      }
    });

    // Add themes without selected children
    selectedThemes.forEach(theme => {
      const hasSelectedChildren = [
        ...selectedSubthemes,
        ...selectedGroups,
      ].some(item => {
        const themeData = taxonomyData.find((t: any) => t._id === theme.id);
        if (!themeData?.children) return false;

        return item.type === 'subtheme'
          ? themeData.children.some((s: any) => s._id === item.id)
          : themeData.children.some((s: any) =>
              s.children?.some((g: any) => g._id === item.id),
            );
      });

      if (!hasSelectedChildren && !processedIds.has(theme.id)) {
        result.push(theme);
        processedIds.add(theme.id);
      }
    });

    return result;
  };

  const mostSpecificSelections = getMostSpecificSelections();
  const subthemesToShow = getSubthemesToShow();

  // Loading/empty states
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
    type: TaxonomyItem['type'],
  ) => {
    const newSelection = [...selection];
    const existingIndex = newSelection.findIndex(item => item.id === id);

    if (existingIndex === -1) {
      // Add item
      newSelection.push({ id, name, type });

      // For subthemes, add all groups
      if (type === 'subtheme') {
        const groups = taxonomyUtils.findSubthemeGroups(taxonomyData, id);
        groups.forEach((group: any) => {
          if (!newSelection.some(item => item.id === group._id)) {
            newSelection.push({
              id: group._id,
              name: group.name,
              type: 'group',
            });
          }
        });
      }
    } else {
      // Remove item
      newSelection.splice(existingIndex, 1);

      // Remove children for themes/subthemes
      if (type === 'theme' || type === 'subtheme') {
        const filtered = selectionUtils.removeByParent(
          newSelection,
          taxonomyData,
          id,
          type,
        );
        setValue('taxonomySelection', filtered, { shouldDirty: true });
        return;
      }
    }

    setValue('taxonomySelection', newSelection, { shouldDirty: true });
  };

  const toggleGroupExpansion = (subthemeId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      newSet.has(subthemeId)
        ? newSet.delete(subthemeId)
        : newSet.add(subthemeId);
      return newSet;
    });
  };

  const clearAll = () =>
    setValue('taxonomySelection', [], { shouldDirty: true });

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
          {taxonomyData.map((theme: any) => (
            <button
              key={theme._id}
              type="button"
              onClick={() => toggleSelection(theme._id, theme.name, 'theme')}
              className={`rounded px-3 py-2 text-left text-sm font-medium transition-colors ${
                isSelected(theme._id)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {theme.name}
            </button>
          ))}
        </div>
      </div>

      {/* Subtemas Section */}
      {subthemesToShow.length > 0 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">Subtemas</Label>
          <div className="space-y-4">
            {Object.entries(
              subthemesToShow.reduce((acc: any, subtheme: any) => {
                if (!acc[subtheme.themeName]) acc[subtheme.themeName] = [];
                acc[subtheme.themeName].push(subtheme);
                return acc;
              }, {}),
            ).map(([themeName, subthemes]: [string, any]) => (
              <div key={themeName} className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">
                  {themeName}
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {subthemes.map((subtheme: any) => {
                    const selected = isSelected(subtheme._id);
                    const partial = isSubthemePartial(subtheme._id);

                    return (
                      <div key={subtheme._id} className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <div className="relative">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() =>
                                toggleSelection(
                                  subtheme._id,
                                  subtheme.name,
                                  'subtheme',
                                )
                              }
                            />
                            {partial && (
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <Minus className="h-3 w-3 text-orange-600" />
                              </div>
                            )}
                          </div>
                          <Label className="flex-1 cursor-pointer text-sm">
                            {subtheme.name}
                            {partial && (
                              <span className="ml-1 text-xs font-medium text-orange-600">
                                (parcial)
                              </span>
                            )}
                          </Label>
                          {subtheme.children?.length > 0 && (
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
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escopo Ativo */}
      {mostSpecificSelections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Escopo Ativo (
              {mostSpecificSelections.filter(item => !item.isExcluded).length}{' '}
              incluído
              {mostSpecificSelections.filter(item => !item.isExcluded)
                .length === 1
                ? ''
                : 's'}
              {mostSpecificSelections.some(item => item.isExcluded) &&
                `, ${mostSpecificSelections.filter(item => item.isExcluded).length} excluído${
                  mostSpecificSelections.filter(item => item.isExcluded)
                    .length === 1
                    ? ''
                    : 's'
                }`}
              ):
            </Label>
            <Button variant="ghost" size="sm" type="button" onClick={clearAll}>
              Limpar Tudo
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {mostSpecificSelections.map(item => {
              const isPartial =
                item.type === 'subtheme' && isSubthemePartial(item.id);

              return (
                <Badge
                  key={item.id}
                  variant={
                    item.isExcluded
                      ? 'destructive'
                      : isPartial
                        ? 'secondary'
                        : 'outline'
                  }
                  className={`text-xs ${
                    item.isExcluded
                      ? 'border-red-200 bg-red-50 line-through opacity-80'
                      : isPartial
                        ? 'border-orange-200 bg-orange-50'
                        : ''
                  }`}
                >
                  {item.isExcluded && (
                    <span className="mr-1 font-bold text-red-600">✕</span>
                  )}
                  {isPartial && (
                    <span className="mr-1 font-bold text-orange-600">±</span>
                  )}
                  {item.name}
                  <span
                    className={`ml-1 ${
                      item.isExcluded
                        ? 'text-red-400'
                        : isPartial
                          ? 'text-orange-600'
                          : 'text-muted-foreground'
                    }`}
                  >
                    (
                    {item.type === 'theme'
                      ? '🎯'
                      : item.type === 'subtheme'
                        ? '📂'
                        : '📄'}
                    )
                  </span>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Helper text */}
      {selection.length === 0 && (
        <div className="text-muted-foreground py-4 text-center text-sm">
          👆 Selecione temas para começar a filtrar questões
          <div className="mt-2 text-xs">
            💡 <strong>Dica:</strong> Ao selecionar um subtema, todos os seus
            grupos são incluídos automaticamente.
          </div>
        </div>
      )}
    </CardContent>
  );
}
