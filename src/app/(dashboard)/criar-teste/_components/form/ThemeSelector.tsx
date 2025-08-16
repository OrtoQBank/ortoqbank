'use client';

import { useQuery } from 'convex-helpers/react/cache/hooks';
import { InfoIcon as InfoCircle } from 'lucide-react';
import { memo } from 'react';
import { type Control, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';
import { useFormContext } from '../context/FormContext';
import { TestFormData } from '../schema';

type Theme = { _id: string; name: string };

type ThemeSelectorProps = {
  control: Control<TestFormData>;
  themes: Theme[];
  onToggleTheme: (themeId: string) => void;
  error?: string;
};

const ThemeQuestionCount = memo(
  ({ themeId, questionMode }: { themeId: string; questionMode: string }) => {
    if (questionMode === 'unanswered') {
      return <UnansweredThemeCount themeId={themeId} />;
    }
    if (questionMode === 'incorrect') {
      return <IncorrectThemeCount themeId={themeId} />;
    }

    if (questionMode === 'bookmarked') {
      return <BookmarkedThemeCount themeId={themeId} />;
    }

    return <StandardThemeCount themeId={themeId} />;
  },
);
ThemeQuestionCount.displayName = 'ThemeQuestionCount';

const IncorrectThemeCount = memo(({ themeId }: { themeId: string }) => {
  const { userCountsForQuizCreation, isLoading } = useFormContext();

  if (isLoading || !userCountsForQuizCreation) {
    return <span className="text-xs text-gray-400">...</span>;
  }

  const count = userCountsForQuizCreation.byTheme[themeId]?.incorrect || 0;

  return (
    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-600">
      {count}
    </span>
  );
});
IncorrectThemeCount.displayName = 'IncorrectThemeCount';

const BookmarkedThemeCount = memo(({ themeId }: { themeId: string }) => {
  const { userCountsForQuizCreation, isLoading } = useFormContext();

  if (isLoading || !userCountsForQuizCreation) {
    return <span className="text-xs text-gray-400">...</span>;
  }

  const count = userCountsForQuizCreation.byTheme[themeId]?.bookmarked || 0;

  return (
    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">
      {count}
    </span>
  );
});
BookmarkedThemeCount.displayName = 'BookmarkedThemeCount';

const StandardThemeCount = memo(({ themeId }: { themeId: string }) => {
  const count = useQuery(api.aggregateQueries.getThemeQuestionCountQuery, {
    themeId: themeId as Id<'themes'>,
  });

  if (count === undefined) {
    return <span className="text-xs text-gray-400">...</span>;
  }

  return (
    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
      {count}
    </span>
  );
});
StandardThemeCount.displayName = 'StandardThemeCount';

const UnansweredThemeCount = memo(({ themeId }: { themeId: string }) => {
  const total = useQuery(api.aggregateQueries.getThemeQuestionCountQuery, {
    themeId: themeId as Id<'themes'>,
  });
  const { userCountsForQuizCreation, isLoading } = useFormContext();

  if (total === undefined || isLoading || !userCountsForQuizCreation) {
    return <span className="text-xs text-gray-400">...</span>;
  }

  const answered = userCountsForQuizCreation.byTheme[themeId]?.answered || 0;
  const unanswered = Math.max(0, (total as number) - answered);

  return (
    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
      {unanswered}
    </span>
  );
});
UnansweredThemeCount.displayName = 'UnansweredThemeCount';
export const ThemeSelector = memo(function ThemeSelector({
  control,
  themes,
  onToggleTheme,
  error,
}: ThemeSelectorProps) {
  const selectedThemes = useWatch({ control, name: 'selectedThemes' });
  const questionMode = useWatch({ control, name: 'questionMode' });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">Temas</h3>
        <Popover>
          <PopoverTrigger asChild>
            <InfoCircle className="text-muted-foreground h-4 w-4 cursor-pointer" />
          </PopoverTrigger>
          <PopoverContent className="max-w-xs border border-black">
            <p>
              Selecione um ou mais temas para filtrar as questões. Clicar em um
              tema mostra os subtemas e grupos relacionados.
            </p>
          </PopoverContent>
        </Popover>
      </div>
      <div className="xs:grid-cols-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {themes?.map(theme => {
          return (
            <Button
              key={theme._id}
              type="button"
              onClick={() => onToggleTheme(theme._id)}
              variant={
                selectedThemes.includes(theme._id) ? 'default' : 'outline'
              }
              className="h-auto w-full justify-between py-2 text-left"
            >
              <span className="flex-1 truncate text-sm">{theme.name}</span>
              <ThemeQuestionCount
                themeId={theme._id}
                questionMode={questionMode}
              />
            </Button>
          );
        })}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
});
