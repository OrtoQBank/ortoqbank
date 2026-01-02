import { useQuery } from 'convex/react';
import { useMemo, useState } from 'react';

import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';
import { normalizeText } from '../../../../../../convex/utils';

export function useTaxonomyData(
  defaultThemeId?: Id<'themes'>,
  defaultSubthemeId?: Id<'subthemes'>,
  defaultGroupId?: Id<'groups'>,
) {
  const [selectedTheme, setSelectedTheme] = useState<Id<'themes'> | undefined>(
    defaultThemeId,
  );
  const [selectedSubtheme, setSelectedSubtheme] = useState<
    Id<'subthemes'> | undefined
  >(defaultSubthemeId);
  const [selectedGroup, setSelectedGroup] = useState<Id<'groups'> | undefined>(
    defaultGroupId,
  );

  // Query data
  const themes = useQuery(api.themes.list);
  const subthemes = useQuery(
    api.subthemes.list,
    selectedTheme ? { themeId: selectedTheme } : 'skip',
  );
  const groups = useQuery(
    api.groups.list,
    selectedSubtheme ? { subthemeId: selectedSubtheme } : 'skip',
  );

  // Query for question count
  const themeQuestionCount = useQuery(
    api.questions.getQuestionCountForTheme,
    selectedTheme ? { themeId: selectedTheme } : 'skip',
  );

  // Derive generatedId using useMemo instead of effect + state
  const generatedId = useMemo(() => {
    // Don't try to generate if theme not selected or data not loaded
    if (!selectedTheme || !themes || themeQuestionCount === undefined) {
      return '';
    }

    const theme = themes.find(t => t._id === selectedTheme);
    if (!theme) {
      return '';
    }

    // Get theme prefix from the database or default to first 3 letters
    const themePrefix = theme.prefix
      ? normalizeText(theme.prefix).toUpperCase()
      : normalizeText(theme.name.slice(0, 3)).toUpperCase();

    // Build parts of the ID
    let codePrefix = themePrefix;

    // Add subtheme prefix if selected
    if (selectedSubtheme && subthemes) {
      const subtheme = subthemes.find(s => s._id === selectedSubtheme);
      if (subtheme?.prefix) {
        const normalizedSubthemePrefix = normalizeText(
          subtheme.prefix,
        ).toUpperCase();
        codePrefix += `-${normalizedSubthemePrefix}`;
      }
    }

    // Add group prefix if selected
    if (selectedGroup && groups) {
      const group = groups.find(g => g._id === selectedGroup);
      if (group?.prefix) {
        const normalizedGroupPrefix = normalizeText(group.prefix).toUpperCase();
        codePrefix += `-${normalizedGroupPrefix}`;
      }
    }

    // The count from the aggregate is the current count, so add 1 for the new question
    const count = (themeQuestionCount || 0) + 1;
    // Increase padding to 4 digits
    const paddedCount = String(count).padStart(4, '0');

    return `${codePrefix}-${paddedCount}`;
  }, [
    selectedTheme,
    selectedSubtheme,
    selectedGroup,
    themes,
    subthemes,
    groups,
    themeQuestionCount,
  ]);

  // Reset dependent fields when parent selection changes
  const handleThemeChange = (themeId: Id<'themes'> | undefined) => {
    setSelectedTheme(themeId);
    setSelectedSubtheme(undefined);
    setSelectedGroup(undefined);
  };

  const handleSubthemeChange = (subthemeId: Id<'subthemes'> | undefined) => {
    setSelectedSubtheme(subthemeId);
    setSelectedGroup(undefined);
  };

  return {
    // Data
    themes,
    subthemes,
    groups,

    // Selected values
    selectedTheme,
    selectedSubtheme,
    selectedGroup,

    // Setters with cascading reset
    setSelectedTheme: handleThemeChange,
    setSelectedSubtheme: handleSubthemeChange,
    setSelectedGroup,

    // Generated ID
    generatedId,
  };
}
