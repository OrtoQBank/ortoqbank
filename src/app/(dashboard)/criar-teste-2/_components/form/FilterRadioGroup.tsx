import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface FilterRadioGroupProps {
  value: 'all' | 'unanswered' | 'incorrect' | 'bookmarked';
  onChange: (value: 'all' | 'unanswered' | 'incorrect' | 'bookmarked') => void;
}

export function FilterRadioGroup({ value, onChange }: FilterRadioGroupProps) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Filtros de Questões</Label>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="grid grid-cols-2 gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="all" id="all" />
          <Label htmlFor="all" className="font-normal">
            Todas
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="unanswered" id="unanswered" />
          <Label htmlFor="unanswered" className="font-normal">
            Não respondidas
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="incorrect" id="incorrect" />
          <Label htmlFor="incorrect" className="font-normal">
            Incorretas
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="bookmarked" id="bookmarked" />
          <Label htmlFor="bookmarked" className="font-normal">
            Favoritas
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
