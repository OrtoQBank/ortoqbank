import { useFormContext } from 'react-hook-form';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type FormData = {
  mode: 'exam' | 'study';
  filter: 'all' | 'unanswered' | 'incorrect' | 'bookmarked';
  taxonomySelection: string[];
  totalQuestions: number;
};

export function DebugPanel() {
  const {
    watch,
    formState: { errors, isSubmitting, isDirty, isValid },
  } = useFormContext();

  // Watch all fields at once to prevent infinite re-renders
  const formData = watch() as FormData;

  const apiPayload = {
    name: `Teste ${formData.mode === 'exam' ? 'Exame' : 'Estudo'}`,
    description: `Teste criado em`,
    testMode: formData.mode,
    questionMode: formData.filter,
    numQuestions: formData.totalQuestions,
    selectedThemes: [],
    selectedSubthemes: [],
    selectedGroups: [],
  };

  return (
    <Card className="mx-auto mt-6 max-w-2xl border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="text-lg text-yellow-800">
          Debug Panel 🐛
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700">
            Form State:
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div
              className={`rounded p-2 ${isSubmitting ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}
            >
              Submitting: {isSubmitting ? 'Yes' : 'No'}
            </div>
            <div
              className={`rounded p-2 ${isDirty ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
            >
              Dirty: {isDirty ? 'Yes' : 'No'}
            </div>
            <div
              className={`rounded p-2 ${isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
            >
              Valid: {isValid ? 'Yes' : 'No'}
            </div>
            <div
              className={`rounded p-2 ${Object.keys(errors).length > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}
            >
              Errors: {Object.keys(errors).length}
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700">
            Current Form Data:
          </h4>
          <pre className="overflow-x-auto rounded border bg-white p-3 text-xs">
            {JSON.stringify(formData, null, 2)}
          </pre>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700">
            Taxonomy Selection:
          </h4>
          <pre className="overflow-x-auto rounded border bg-white p-3 text-xs">
            {JSON.stringify(formData.taxonomySelection, null, 2)}
          </pre>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700">
            API Payload (how data will be submitted):
          </h4>
          <pre className="overflow-x-auto rounded border bg-white p-3 text-xs">
            {JSON.stringify(apiPayload, null, 2)}
          </pre>
        </div>

        {Object.keys(errors).length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-red-700">
              Form Errors:
            </h4>
            <pre className="overflow-x-auto rounded border border-red-200 bg-red-50 p-3 text-xs">
              {JSON.stringify(errors, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
