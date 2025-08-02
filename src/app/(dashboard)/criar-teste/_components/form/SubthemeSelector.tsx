'use client';

import { useQuery } from 'convex/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';

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
  questionMode: string;
  onToggleSubtheme: (subthemeId: string) => void;
  onToggleGroup: (groupId: string) => void;
  onToggleMultipleGroups?: (groupIds: string[]) => void;
};

function SubthemeQuestionCount({
  subthemeId,
  questionMode,
}: {
  subthemeId: string;
  questionMode: string;
}) {
  if (questionMode === 'incorrect') {
    return <IncorrectSubthemeCount subthemeId={subthemeId} />;
  }

  if (questionMode === 'bookmarked') {
    return <BookmarkedSubthemeCount subthemeId={subthemeId} />;
  }

  return <StandardSubthemeCount subthemeId={subthemeId} />;
}

function IncorrectSubthemeCount({ subthemeId }: { subthemeId: string }) {
  const count = useQuery(
    api.aggregateQueries.getUserIncorrectCountBySubthemeQuery,
    {
      subthemeId: subthemeId as Id<'subthemes'>,
    },
  );

  if (count === undefined) {
    return <span className="ml-1 text-xs text-gray-400">...</span>;
  }

  return (
    <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-600">
      {count}
    </span>
  );
}

function BookmarkedSubthemeCount({ subthemeId }: { subthemeId: string }) {
  const count = useQuery(
    api.aggregateQueries.getUserBookmarksCountBySubthemeQuery,
    {
      subthemeId: subthemeId as Id<'subthemes'>,
    },
  );

  if (count === undefined) {
    return <span className="ml-1 text-xs text-gray-400">...</span>;
  }

  return (
    <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">
      {count}
    </span>
  );
}

function StandardSubthemeCount({ subthemeId }: { subthemeId: string }) {
  const count = useQuery(api.aggregateQueries.getSubthemeQuestionCountQuery, {
    subthemeId: subthemeId as Id<'subthemes'>,
  });

  if (count === undefined) {
    return <span className="ml-1 text-xs text-gray-400">...</span>;
  }

  return (
    <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
      {count}
    </span>
  );
}

function GroupQuestionCount({
  groupId,
  questionMode,
}: {
  groupId: string;
  questionMode: string;
}) {
  if (questionMode === 'incorrect') {
    return <IncorrectGroupCount groupId={groupId} />;
  }

  if (questionMode === 'bookmarked') {
    return <BookmarkedGroupCount groupId={groupId} />;
  }

  return <StandardGroupCount groupId={groupId} />;
}

function IncorrectGroupCount({ groupId }: { groupId: string }) {
  const count = useQuery(
    api.aggregateQueries.getUserIncorrectCountByGroupQuery,
    {
      groupId: groupId as Id<'groups'>,
    },
  );

  if (count === undefined) {
    return <span className="ml-1 text-xs text-gray-400">...</span>;
  }

  return (
    <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-600">
      {count}
    </span>
  );
}

function BookmarkedGroupCount({ groupId }: { groupId: string }) {
  const count = useQuery(
    api.aggregateQueries.getUserBookmarksCountByGroupQuery,
    {
      groupId: groupId as Id<'groups'>,
    },
  );

  if (count === undefined) {
    return <span className="ml-1 text-xs text-gray-400">...</span>;
  }

  return (
    <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">
      {count}
    </span>
  );
}

function StandardGroupCount({ groupId }: { groupId: string }) {
  const count = useQuery(api.aggregateQueries.getGroupQuestionCountQuery, {
    groupId: groupId as Id<'groups'>,
  });

  if (count === undefined) {
    return <span className="ml-1 text-xs text-gray-400">...</span>;
  }

  return (
    <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
      {count}
    </span>
  );
}

function ThemeQuestionCount({
  themeId,
  questionMode,
}: {
  themeId: string;
  questionMode: string;
}) {
  if (questionMode === 'incorrect') {
    return <IncorrectThemeCount themeId={themeId} />;
  }

  if (questionMode === 'bookmarked') {
    return <BookmarkedThemeCount themeId={themeId} />;
  }

  return <StandardThemeCount themeId={themeId} />;
}

function IncorrectThemeCount({ themeId }: { themeId: string }) {
  const count = useQuery(
    api.aggregateQueries.getUserIncorrectCountByThemeQuery,
    {
      themeId: themeId as Id<'themes'>,
    },
  );

  if (count === undefined) {
    return <span className="ml-1 text-xs text-gray-400">...</span>;
  }

  return (
    <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-600">
      {count}
    </span>
  );
}

function BookmarkedThemeCount({ themeId }: { themeId: string }) {
  const count = useQuery(
    api.aggregateQueries.getUserBookmarksCountByThemeQuery,
    {
      themeId: themeId as Id<'themes'>,
    },
  );

  if (count === undefined) {
    return <span className="ml-1 text-xs text-gray-400">...</span>;
  }

  return (
    <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">
      {count}
    </span>
  );
}

function StandardThemeCount({ themeId }: { themeId: string }) {
  const count = useQuery(api.aggregateQueries.getThemeQuestionCountQuery, {
    themeId: themeId as Id<'themes'>,
  });

  if (count === undefined) {
    return <span className="ml-1 text-xs text-gray-400">...</span>;
  }

  return (
    <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
      {count}
    </span>
  );
}

export function SubthemeSelector({
  themes,
  subthemes,
  groups,
  selectedThemes,
  selectedSubthemes,
  selectedGroups,
  questionMode,
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
            <div className="flex min-w-0 flex-1 items-center">
              <Label
                htmlFor={subtheme._id}
                className="text-sm font-medium hyphens-auto"
              >
                {subtheme.name}
              </Label>
              <SubthemeQuestionCount
                subthemeId={subtheme._id}
                questionMode={questionMode}
              />
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
                  <div className="flex min-w-0 flex-1 items-center">
                    <Label htmlFor={group._id} className="text-sm hyphens-auto">
                      {group.name}
                    </Label>
                    <GroupQuestionCount
                      groupId={group._id}
                      questionMode={questionMode}
                    />
                  </div>
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
      questionMode,
    ],
  );

  // Memoize theme components to avoid unnecessary re-renders
  const themeComponents = useMemo(() => {
    return selectedThemes.map(themeId => {
      const theme = themes.find(t => t._id === themeId);
      const themeSubthemesList = themeSubthemes[themeId] || [];

      return themeSubthemesList.length > 0 ? (
        <div key={themeId} className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-muted-foreground text-sm font-medium hyphens-auto">
              {theme?.name}
            </h4>
            <ThemeQuestionCount themeId={themeId} questionMode={questionMode} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {themeSubthemesList.map(subtheme => (
              <SubthemeItem key={subtheme._id} subtheme={subtheme} />
            ))}
          </div>
        </div>
      ) : undefined;
    });
  }, [selectedThemes, themes, themeSubthemes, SubthemeItem, questionMode]);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium">Subtemas</h3>
      {themeComponents}
    </div>
  );
}
