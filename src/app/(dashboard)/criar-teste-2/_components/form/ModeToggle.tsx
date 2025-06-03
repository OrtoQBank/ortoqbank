import { useFormContext } from 'react-hook-form';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function ModeToggle() {
  const { watch, setValue } = useFormContext();
  const value = watch('mode') as 'exam' | 'study';

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Modo do Teste</Label>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Switch
            checked={value === 'study'}
            onCheckedChange={checked =>
              setValue('mode', checked ? 'study' : 'exam', {
                shouldDirty: true,
              })
            }
          />
          <Label className="font-normal">
            {value === 'exam' ? 'Exame' : 'Estudo'}
          </Label>
        </div>
      </div>
    </div>
  );
}
