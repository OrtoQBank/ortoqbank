import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface TaxonomyFilterProps {
  selectedItems: string[];
  onSelectionChange: (items: string[]) => void;
}

export function TaxonomyFilter({
  selectedItems,
  onSelectionChange,
}: TaxonomyFilterProps) {
  // Placeholder taxonomy data - this will be replaced with actual data
  const placeholderItems = [
    { id: 'anatomy', label: 'Anatomia' },
    { id: 'physiology', label: 'Fisiologia' },
    { id: 'pathology', label: 'Patologia' },
    { id: 'pharmacology', label: 'Farmacologia' },
    { id: 'surgery', label: 'Cirurgia' },
    { id: 'medicine', label: 'Medicina Interna' },
  ];

  const handleItemToggle = (itemId: string) => {
    const updatedItems = selectedItems.includes(itemId)
      ? selectedItems.filter(id => id !== itemId)
      : [...selectedItems, itemId];

    onSelectionChange(updatedItems);
  };

  const handleSelectAll = () => {
    if (selectedItems.length === placeholderItems.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(placeholderItems.map(item => item.id));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {selectedItems.length} de {placeholderItems.length} selecionados
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
        >
          {selectedItems.length === placeholderItems.length
            ? 'Desmarcar todos'
            : 'Selecionar todos'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {placeholderItems.map(item => (
          <div key={item.id} className="flex items-center space-x-2">
            <Checkbox
              id={item.id}
              checked={selectedItems.includes(item.id)}
              onCheckedChange={() => handleItemToggle(item.id)}
            />
            <Label htmlFor={item.id} className="font-normal">
              {item.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
