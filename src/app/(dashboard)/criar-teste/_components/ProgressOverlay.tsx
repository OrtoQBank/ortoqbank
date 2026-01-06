'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Id } from '../../../../../convex/_generated/dataModel';

interface ProgressOverlayProps {
  isVisible: boolean;
  status: string;
  progress: number;
  progressMessage?: string;
  quizId?: Id<'customQuizzes'>;
  questionCount?: number;
  error?: string;
  errorMessage?: string;
  onClose?: () => void;
}

export function ProgressOverlay({
  isVisible,
  status,
  progress,
  progressMessage,
  quizId,
  questionCount,
  error,
  errorMessage,
  onClose,
}: ProgressOverlayProps) {
  const router = useRouter();

  // Auto-redirect on completion
  useEffect(() => {
    if (status === 'completed' && quizId) {
      const timer = setTimeout(() => {
        router.push(`/criar-teste/${quizId}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, quizId, router]);

  const getStatusIcon = () => {
    switch (status) {
      case 'completed': {
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
          >
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
          </motion.div>
        );
      }
      case 'failed': {
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
          >
            <XCircle className="h-16 w-16 text-red-500" />
          </motion.div>
        );
      }
      default: {
        return <Loader2 className="text-brand-blue h-16 w-16 animate-spin" />;
      }
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'pending': {
        return 'Iniciando...';
      }
      case 'collecting_questions': {
        return 'Coletando questões';
      }
      case 'applying_filters': {
        return 'Aplicando filtros';
      }
      case 'selecting_questions': {
        return 'Selecionando questões';
      }
      case 'creating_quiz': {
        return 'Criando quiz';
      }
      case 'completed': {
        return 'Quiz criado com sucesso!';
      }
      case 'failed': {
        return 'Erro ao criar quiz';
      }
      default: {
        return 'Processando...';
      }
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="mx-4 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
          >
            <div className="flex flex-col items-center text-center">
              {/* Status Icon */}
              <div className="mb-6">{getStatusIcon()}</div>

              {/* Title */}
              <h2 className="mb-2 text-xl font-semibold text-gray-900">
                {getStatusTitle()}
              </h2>

              {/* Progress Message */}
              <p className="mb-6 text-gray-600">
                {status === 'completed' && questionCount
                  ? `Seu quiz com ${questionCount} questões foi criado. Redirecionando...`
                  : status === 'failed'
                    ? errorMessage || 'Ocorreu um erro ao criar o quiz.'
                    : progressMessage || 'Aguarde...'}
              </p>

              {/* Progress Bar */}
              {!['completed', 'failed'].includes(status) && (
                <div className="w-full">
                  <div className="mb-2 flex justify-between text-sm text-gray-500">
                    <span>Progresso</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <motion.div
                      className="from-brand-blue h-full bg-gradient-to-r to-blue-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              {/* Error Close Button */}
              {status === 'failed' && onClose && (
                <button
                  onClick={onClose}
                  className="mt-6 rounded-lg bg-gray-100 px-6 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
