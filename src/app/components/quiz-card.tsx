'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

const questions = [
  {
    question: 'Quantos ossos tem o corpo humano adulto?',
    alternatives: ['206', '208', '212', '200'],
    correctAlternativeIndex: 0,
  },
  {
    question: 'Qual é a articulação mais móvel do corpo humano?',
    alternatives: ['Ombro', 'Quadril', 'Joelho', 'Cotovelo'],
    correctAlternativeIndex: 0,
  },
  {
    question: 'Qual é o osso mais longo do corpo humano?',
    alternatives: ['Fêmur', 'Tíbia', 'Fíbula', 'Úmero'],
    correctAlternativeIndex: 0,
  },
];

const getButtonStyle = (isActive: boolean, isCorrect: boolean | undefined) => {
  if (!isActive) return 'bg-white text-brand-blue hover:bg-gray-100';
  if (isCorrect) return 'bg-green-500 text-white hover:bg-green-600';
  return 'bg-red-500 text-white hover:bg-red-600';
};

export default function QuizCard() {
  const [answeredQuestions, setAnsweredQuestions] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | undefined>();
  const [isCorrect, setIsCorrect] = useState<boolean | undefined>();

  const remainingQuestions = questions.filter(
    (_, index) => !answeredQuestions.includes(index),
  );
  const isCompleted = remainingQuestions.length === 0;

  const handleAnswer = (index: number) => {
    const currentQuestion = remainingQuestions[0];
    const correct = index === currentQuestion.correctAlternativeIndex;
    setSelectedAnswer(index);
    setIsCorrect(correct);

    if (correct) {
      const questionIndex = questions.indexOf(currentQuestion);
      setAnsweredQuestions([...answeredQuestions, questionIndex]);
      setSelectedAnswer(undefined);
      setIsCorrect(undefined);
    }
  };

  if (isCompleted) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center rounded-3xl border border-[#2196F3] bg-white p-4 shadow-lg">
        <div className="text-center">
          <h3 className="mb-3 text-xl font-bold text-brand-blue">
            Excelente trabalho! 🎉
          </h3>
          <p className="mb-4 text-base text-gray-600">
            Você demonstrou um ótimo conhecimento em ortopedia.
          </p>
          <div className="space-y-3 text-sm text-gray-600">
            <p>No OrtoQBank, você encontrará:</p>
            <ul className="mb-4 space-y-2">
              <li>✓ Mais de 1.000 questões especializadas</li>
              <li>✓ Análise detalhada do seu desempenho</li>
              <li>✓ Simulados personalizados</li>
              <li>✓ Explicações completas de cada questão</li>
            </ul>
            <p className="text-brand-blue">
              Cadastre-se agora para elevar seus estudos ao próximo nível!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[300px] w-full">
      {remainingQuestions.slice(0, 3).map((question, index) => {
        return (
          <div
            key={questions.indexOf(question)}
            className={`absolute inset-0 w-full rounded-3xl border border-brand-blue bg-white p-4 shadow-lg transition-all duration-300 ${
              {
                0: 'z-20',
                1: 'z-10 translate-y-2',
                2: 'z-0 translate-y-4',
              }[index] || ''
            }`}
          >
            <h3 className="mb-3 text-xl font-semibold text-brand-blue">
              {question.question}
            </h3>
            <div className="space-y-1.5">
              {question.alternatives.map((alternative, alternativeIndex) => (
                <Button
                  key={alternativeIndex}
                  className={`w-full justify-start ${getButtonStyle(
                    index === 0 && selectedAnswer === alternativeIndex,
                    isCorrect,
                  )} border border-brand-blue`}
                  onClick={() => index === 0 && handleAnswer(alternativeIndex)}
                  disabled={
                    index !== 0 ||
                    (selectedAnswer === alternativeIndex && isCorrect)
                  }
                >
                  {alternative}
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
