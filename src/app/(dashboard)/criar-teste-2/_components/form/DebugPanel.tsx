import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type FormData = {
  mode: 'exam' | 'study';
  filter: 'all' | 'unanswered' | 'incorrect' | 'bookmarked';
  taxonomySelection: string[];
  totalQuestions: number;
};

interface DebugPanelProps {
  formData: FormData;
  taxonomySelection: string[];
  errors: any;
}

export function DebugPanel({
  formData,
  taxonomySelection,
  errors,
}: DebugPanelProps) {
  const apiPayload = {
    name: `Teste ${formData.mode === 'exam' ? 'Exame' : 'Estudo'} - ${new Date().toLocaleDateString()}`,
    description: `Teste criado em ${new Date().toLocaleDateString()}`,
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
            Current Form State:
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
            {JSON.stringify(taxonomySelection, null, 2)}
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
