'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

type Theme = { _id: string; name: string };
type Subtheme = { _id: string; name: string; themeId: string };
type Group = { _id: string; name: string; subthemeId: string };

type SubthemeSelectorProps = {
  themes: Theme[];
  subthemes: Subtheme[];
  groups: Group[];
  selectedThemes: string[];
  selectedSubthemes: string[];
  selectedGroups: string[];
  onToggleSubtheme: (subthemeId: string) => void;
  onToggleGroup: (groupId: string) => void;
  onToggleMultipleGroups?: (groupIds: string[]) => void;
};

export function SubthemeSelector({
  themes,
  subthemes,
  groups,
  selectedThemes,
  selectedSubthemes,
  selectedGroups,
  onToggleSubtheme,
  onToggleGroup,
  onToggleMultipleGroups,
}: SubthemeSelectorProps) {
  const [expandedSubthemes, setExpandedSubthemes] = useState<string[]>([]);

  // Memoize theme to subthemes mapping
  const themeSubthemes = useMemo(() => {
    return themes.reduce(
      (acc, theme) => {
        acc[theme._id] = subthemes.filter(s => s.themeId === theme._id) || [];
        return acc;
      },
      {} as Record<string, Subtheme[]>,
    );
  }, [themes, subthemes]);

  // Memoize subtheme to groups mapping
  const subthemeToGroupsMap = useMemo(() => {
    return groups.reduce(
      (acc, group) => {
        if (!acc[group.subthemeId]) {
          acc[group.subthemeId] = [];
        }
        acc[group.subthemeId].push(group);
        return acc;
      },
      {} as Record<string, Group[]>,
    );
  }, [groups]);

  // Get groups for a subtheme - now uses the memoized map
  const getSubthemeGroups = useCallback(
    (subthemeId: string) => subthemeToGroupsMap[subthemeId] || [],
    [subthemeToGroupsMap],
  );

  // Toggle subtheme expansion state
  const toggleExpanded = useCallback((subthemeId: string) => {
    setExpandedSubthemes(prev =>
      prev.includes(subthemeId)
        ? prev.filter(id => id !== subthemeId)
        : [...prev, subthemeId],
    );
  }, []);

  // Handle selecting/unselecting a subtheme and all its groups
  const handleSubthemeToggle = useCallback(
    (subtheme: Subtheme) => {
      const subthemeGroups = getSubthemeGroups(subtheme._id);
      const isSelected = selectedSubthemes.includes(subtheme._id);

      // Toggle the subtheme itself
      onToggleSubtheme(subtheme._id);

      if (isSelected) {
        // Find all selected groups to unselect
        const groupsToUnselect = subthemeGroups
          .filter(group => selectedGroups.includes(group._id))
          .map(group => group._id);

        // Toggle all at once if possible, otherwise toggle one by one
        if (onToggleMultipleGroups && groupsToUnselect.length > 0) {
          onToggleMultipleGroups(groupsToUnselect);
        } else {
          // Fallback to toggling one by one
          for (const groupId of groupsToUnselect) {
            onToggleGroup(groupId);
          }
        }
      } else {
        // Find all unselected groups to select
        const groupsToSelect = subthemeGroups
          .filter(group => !selectedGroups.includes(group._id))
          .map(group => group._id);

        // Toggle all at once if possible, otherwise toggle one by one
        if (onToggleMultipleGroups && groupsToSelect.length > 0) {
          onToggleMultipleGroups(groupsToSelect);
        } else {
          // Fallback to toggling one by one
          for (const groupId of groupsToSelect) {
            onToggleGroup(groupId);
          }
        }
      }
    },
    [
      getSubthemeGroups,
      selectedSubthemes,
      selectedGroups,
      onToggleSubtheme,
      onToggleGroup,
      onToggleMultipleGroups,
    ],
  );

  // Memoized component for individual subtheme item
  const SubthemeItem = useCallback(
    ({ subtheme }: { subtheme: Subtheme }) => {
      const subthemeGroups = getSubthemeGroups(subtheme._id);
      const isSelected = selectedSubthemes.includes(subtheme._id);
      const hasGroups = subthemeGroups.length > 0;
      const isExpanded = expandedSubthemes.includes(subtheme._id);

      return (
        <div className="">
          <div className="flex items-center gap-2">
            <Checkbox
              id={subtheme._id}
              checked={isSelected}
              onCheckedChange={() => handleSubthemeToggle(subtheme)}
              className="mt-0.5 flex-shrink-0"
            />
            <div className="min-w-0">
              <Label
                htmlFor={subtheme._id}
                className="text-sm font-medium hyphens-auto"
              >
                {subtheme.name}
              </Label>
            </div>
            {hasGroups && (
              <button
                onClick={() => toggleExpanded(subtheme._id)}
                className="text-muted-foreground hover:text-foreground flex-shrink-0 text-center"
                type="button"
                aria-label={isExpanded ? 'Collapse groups' : 'Expand groups'}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {hasGroups && isExpanded && (
            <div className="mt-3 space-y-2 pl-6">
              {subthemeGroups.map(group => (
                <div key={group._id} className="flex items-start gap-2">
                  <Checkbox
                    id={group._id}
                    checked={selectedGroups.includes(group._id)}
                    onCheckedChange={() => onToggleGroup(group._id)}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <Label
                    htmlFor={group._id}
                    className="min-w-0 flex-1 text-sm hyphens-auto"
                  >
                    {group.name}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    },
    [
      getSubthemeGroups,
      selectedSubthemes,
      selectedGroups,
      expandedSubthemes,
      handleSubthemeToggle,
      toggleExpanded,
      onToggleGroup,
    ],
  );

  // Memoize theme components to avoid unnecessary re-renders
  const themeComponents = useMemo(() => {
    return selectedThemes.map(themeId => {
      const theme = themes.find(t => t._id === themeId);
      const themeSubthemesList = themeSubthemes[themeId] || [];

      return themeSubthemesList.length > 0 ? (
        <div key={themeId} className="space-y-3">
          <h4 className="text-muted-foreground text-sm font-medium hyphens-auto">
            {theme?.name}
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {themeSubthemesList.map(subtheme => (
              <SubthemeItem key={subtheme._id} subtheme={subtheme} />
            ))}
          </div>
        </div>
      ) : undefined;
    });
  }, [selectedThemes, themes, themeSubthemes, SubthemeItem]);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium">Subtemas</h3>
      {themeComponents}
    </div>
  );
}
