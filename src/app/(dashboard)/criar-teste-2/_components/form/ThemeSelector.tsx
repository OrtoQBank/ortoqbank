'use client';

import { InfoIcon as InfoCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type Theme = { _id: string; name: string };

type ThemeSelectorProps = {
  themes: Theme[];
  selectedThemes: string[];
  onToggleTheme: (themeId: string) => void;
  error?: string;
};

export function ThemeSelector({
  themes,
  selectedThemes,
  onToggleTheme,
  error,
}: ThemeSelectorProps) {
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
              className="h-auto w-full justify-start py-2 text-left"
            >
              <span className="flex-1 truncate text-sm">{theme.name}</span>
            </Button>
          );
        })}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
