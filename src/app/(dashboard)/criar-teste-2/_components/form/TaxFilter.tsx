'use client';

import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function TaxFilter({ taxonomyData }: { taxonomyData: any }) {
  const { watch, setValue } = useFormContext();

  // Get current selection from form
  const selection = watch('taxonomySelection') || [];

  // Helper functions to get selected items by type
  const getSelectedByType = (type: string) => {
    return selection.filter((item: any) => item.type === type);
  };

  const getSelectedIds = (type: string) => {
    return getSelectedByType(type).map((item: any) => item.id);
  };

  // Get available subthemes based on selected themes
  const availableSubthemes = useMemo(() => {
    if (!taxonomyData || !Array.isArray(taxonomyData)) return [];

    const selectedThemeIds = getSelectedIds('theme');
    if (selectedThemeIds.length === 0) return [];

    const subthemes: any[] = [];
    taxonomyData.forEach((theme: any) => {
      if (selectedThemeIds.includes(theme._id) && theme.children) {
        theme.children.forEach((subtheme: any) => {
          subthemes.push({
            ...subtheme,
            themeName: theme.name,
            themeId: theme._id,
          });
        });
      }
    });
    return subthemes;
  }, [taxonomyData, selection]);

  // Get available groups based on selected subthemes
  const availableGroups = useMemo(() => {
    const selectedSubthemeIds = getSelectedIds('subtheme');
    if (selectedSubthemeIds.length === 0) return [];

    const groups: any[] = [];
    availableSubthemes.forEach((subtheme: any) => {
      if (selectedSubthemeIds.includes(subtheme._id) && subtheme.children) {
        subtheme.children.forEach((group: any) => {
          groups.push({
            ...group,
            subthemeName: subtheme.name,
            subthemeId: subtheme._id,
            themeName: subtheme.themeName,
            themeId: subtheme.themeId,
          });
        });
      }
    });
    return groups;
  }, [availableSubthemes, selection]);

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

  const toggleSelection = (id: string, name: string, type: string) => {
    const newSelection = [...selection];
    const existingIndex = newSelection.findIndex((item: any) => item.id === id);

    if (existingIndex === -1) {
      // Add if not selected
      newSelection.push({ id, name, type });
    } else {
      // Remove if already selected
      newSelection.splice(existingIndex, 1);

      // When removing a theme, also remove its subthemes and groups
      if (type === 'theme') {
        const filteredSelection = newSelection.filter((item: any) => {
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
        const filteredSelection = newSelection.filter((item: any) => {
          if (item.type === 'group') {
            const subtheme = availableSubthemes.find((s: any) => s._id === id);
            return !subtheme?.children?.some((g: any) => g._id === item.id);
          }
          return true;
        });
        setValue('taxonomySelection', filteredSelection, { shouldDirty: true });
        return;
      }
    }

    setValue('taxonomySelection', newSelection, { shouldDirty: true });
  };

  const clearAll = () => {
    setValue('taxonomySelection', [], { shouldDirty: true });
  };

  const isSelected = (id: string) => {
    return selection.some((item: any) => item.id === id);
  };

  const selectedThemeIds = getSelectedIds('theme');
  const selectedSubthemeIds = getSelectedIds('subtheme');

  return (
    <CardContent className="space-y-6">
      {/* Step 1: Select Themes */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-800">
            1
          </div>
          <Label className="text-base font-semibold">Selecionar Temas</Label>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {taxonomyData.map((theme: any) => (
            <div
              key={theme._id}
              className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-gray-50"
            >
              <Checkbox
                checked={isSelected(theme._id)}
                onCheckedChange={() =>
                  toggleSelection(theme._id, theme.name, theme.type)
                }
              />
              <Label
                className="flex-1 cursor-pointer font-medium"
                onClick={() =>
                  toggleSelection(theme._id, theme.name, theme.type)
                }
              >
                {theme.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Step 2: Select Subthemes (only if themes are selected) */}
      {selectedThemeIds.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-800">
              2
            </div>
            <Label className="text-base font-semibold">
              Selecionar Subtemas
            </Label>
          </div>
          {availableSubthemes.length > 0 ? (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {availableSubthemes.map((subtheme: any) => (
                <div key={subtheme._id} className="flex items-center space-x-2">
                  <Checkbox
                    checked={isSelected(subtheme._id)}
                    onCheckedChange={() =>
                      toggleSelection(
                        subtheme._id,
                        subtheme.name,
                        subtheme.type,
                      )
                    }
                  />
                  <Label
                    className="cursor-pointer text-sm"
                    onClick={() =>
                      toggleSelection(
                        subtheme._id,
                        subtheme.name,
                        subtheme.type,
                      )
                    }
                  >
                    {subtheme.name}
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm italic">
              Nenhum subtema disponível nos temas selecionados
            </div>
          )}
        </div>
      )}

      {/* Step 3: Select Groups (only if subthemes are selected) */}
      {selectedSubthemeIds.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-medium text-purple-800">
              3
            </div>
            <Label className="text-base font-semibold">Selecionar Grupos</Label>
          </div>
          {availableGroups.length > 0 ? (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {availableGroups.map((group: any) => (
                <div key={group._id} className="flex items-center space-x-2">
                  <Checkbox
                    checked={isSelected(group._id)}
                    onCheckedChange={() =>
                      toggleSelection(group._id, group.name, group.type)
                    }
                  />
                  <Label
                    className="cursor-pointer text-sm"
                    onClick={() =>
                      toggleSelection(group._id, group.name, group.type)
                    }
                  >
                    {group.name}
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm italic">
              Nenhum grupo disponível nos subtemas selecionados
            </div>
          )}
        </div>
      )}
      {/* Current Selection Summary */}
      {selection.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Seleção Atual ({selection.length} itens):
            </Label>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Limpar Tudo
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selection.map((item: any) => (
              <Badge key={item.id} variant="outline" className="text-xs">
                {item.name} ({item.type})
              </Badge>
            ))}
          </div>
        </div>
      )}
      {/* Progress indicator */}
      {selectedThemeIds.length === 0 && (
        <div className="text-muted-foreground py-4 text-center text-sm">
          👆 Comece selecionando um ou mais temas acima
        </div>
      )}
    </CardContent>
  );
}
