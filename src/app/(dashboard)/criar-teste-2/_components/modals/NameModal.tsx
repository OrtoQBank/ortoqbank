'use client';

import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type NameModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export function NameModal({ isOpen, onClose, onSubmit }: NameModalProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Focus input when modal opens with a small delay to ensure DOM is ready
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const input = inputRef.current;
    if (input && input.value.length >= 3) {
      onSubmit(input.value);
    } else {
      toast({
        title: 'Nome muito curto',
        description: 'O nome precisa ter pelo menos 3 caracteres',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Nome do Teste</DialogTitle>
        <DialogDescription>
          Agora que você configurou seu teste, dê um nome a ele.
        </DialogDescription>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="test-name">Nome do Teste</Label>
            <Input
              id="test-name"
              placeholder="Digite um nome para o teste"
              defaultValue="Personalizado"
              className="w-full"
              ref={inputRef}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <p className="text-muted-foreground text-xs">
              O nome deve ter pelo menos 3 caracteres.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit}>
              Criar Teste
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
