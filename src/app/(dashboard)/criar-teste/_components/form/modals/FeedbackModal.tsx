'use client';

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

type FeedbackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  state: 'idle' | 'loading' | 'success' | 'error' | 'no-questions' | 'validation-error';
  message: {
    title: string;
    description: string;
  };
  questionCount?: number;
  onStartQuiz?: () => void;
};

export function FeedbackModal({
  isOpen,
  onClose,
  state,
  message,
  questionCount,
  onStartQuiz,
}: FeedbackModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center justify-center space-y-4 py-6">
          {state === 'loading' && (
            <>
              <Loader2 className="text-brand-blue h-12 w-12 animate-spin" />
              <DialogTitle>Criando seu quiz...</DialogTitle>
              <DialogDescription>
                Estamos preparando seu teste personalizado. Você será
                redirecionado automaticamente assim que estiver pronto.
              </DialogDescription>
            </>
          )}

          {state === 'success' && (
            <>
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <DialogTitle className="text-center text-lg font-medium">
                Quiz pronto
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-center text-sm">
                {questionCount !== undefined
                  ? `${questionCount} questões selecionadas`
                  : message.description}
              </DialogDescription>
              {onStartQuiz && (
                <Button
                  onClick={onStartQuiz}
                  className="bg-brand-blue hover:bg-brand-blue/90 mt-2 w-full"
                >
                  Iniciar
                </Button>
              )}
            </>
          )}

          {state === 'no-questions' && (
            <>
              <AlertTriangle className="h-12 w-12 text-amber-500" />
              <DialogTitle className="text-center">{message.title}</DialogTitle>
              <DialogDescription className="text-center">
                {message.description}
              </DialogDescription>
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <p className="mb-2 font-medium">Sugestões para resolver:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Selecione temas diferentes ou mais abrangentes</li>
                  <li>• Remova alguns filtros de subtemas ou grupos</li>
                  <li>
                    • Altere o modo da questão (ex: &quot;Todas&quot; ao invés
                    de &quot;Incorretas&quot;)
                  </li>
                </ul>
              </div>
              <Button onClick={onClose} variant="outline" className="mt-4">
                Tentar Novamente
              </Button>
            </>
          )}

          {state === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-red-500" />
              <DialogTitle>{message.title}</DialogTitle>
              <DialogDescription>{message.description}</DialogDescription>
              <Button onClick={onClose} variant="outline">
                Fechar
              </Button>
            </>
          )}

          {state === 'validation-error' && (
            <>
              <AlertTriangle className="h-12 w-12 text-amber-500" />
              <DialogTitle className="text-center">{message.title}</DialogTitle>
              <DialogDescription className="text-center">
                {message.description}
              </DialogDescription>
              <Button onClick={onClose} variant="outline" className="mt-4">
                Entendi
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
