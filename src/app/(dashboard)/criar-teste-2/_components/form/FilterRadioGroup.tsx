import { useQuery } from 'convex-helpers/react/cache/hooks';
import { useFormContext } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import { api } from '../../../../../../convex/_generated/api';

export function FilterRadioGroup() {
  const { watch, setValue } = useFormContext();
  const value = watch('filter') as
    | 'all'
    | 'unanswered'
    | 'incorrect'
    | 'bookmarked';

  // Get question counts for all filter types
  const counts = useQuery(api.countFunctions.getAllQuestionCounts);

  // Loading state while counts are being fetched
  const isLoading = counts === undefined;

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Filtros de Questões</Label>
      <RadioGroup
        value={value}
        onValueChange={value =>
          setValue('filter', value, { shouldDirty: true })
        }
        className="grid grid-cols-2 gap-4"
      >
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="all" />
            <Label htmlFor="all" className="font-normal">
              Todas
            </Label>
          </div>
          <Badge variant="secondary" className="text-xs">
            {isLoading ? '...' : counts?.all || 0}
          </Badge>
        </div>
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="unanswered" id="unanswered" />
            <Label htmlFor="unanswered" className="font-normal">
              Não respondidas
            </Label>
          </div>
          <Badge variant="secondary" className="text-xs">
            {isLoading ? '...' : counts?.unanswered || 0}
          </Badge>
        </div>
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="incorrect" id="incorrect" />
            <Label htmlFor="incorrect" className="font-normal">
              Incorretas
            </Label>
          </div>
          <Badge variant="secondary" className="text-xs">
            {isLoading ? '...' : counts?.incorrect || 0}
          </Badge>
        </div>
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="bookmarked" id="bookmarked" />
            <Label htmlFor="bookmarked" className="font-normal">
              Favoritas
            </Label>
          </div>
          <Badge variant="secondary" className="text-xs">
            {isLoading ? '...' : counts?.bookmarked || 0}
          </Badge>
        </div>
      </RadioGroup>
    </div>
  );
}
