import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ModeToggleProps {
  value: 'exam' | 'study';
  onChange: (value: 'exam' | 'study') => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Modo do Teste</Label>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Switch
            checked={value === 'study'}
            onCheckedChange={checked => onChange(checked ? 'study' : 'exam')}
          />
          <Label className="font-normal">
            {value === 'exam' ? 'Exame' : 'Estudo'}
          </Label>
        </div>
      </div>
    </div>
  );
}
