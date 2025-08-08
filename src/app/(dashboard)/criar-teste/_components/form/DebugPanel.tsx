'use client';

import { useMutation } from 'convex/react';
import { Bug, ChevronDown, Copy, Play } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';

import { api } from '../../../../../../convex/_generated/api';

interface DebugPanelProps {
  formData: {
    testMode: string;
    questionMode: string;
    numQuestions: number;
    selectedThemes: string[];
    selectedSubthemes: string[];
    selectedGroups: string[];
  };
  mappedQuestionMode: any;
  availableQuestionCount: number;
  isCountLoading: boolean;
  hierarchicalData?: {
    themes?: Array<{ _id: string; name?: string }>;
    subthemes?: Array<{ _id: string; name?: string; themeId?: string }>;
    groups?: Array<{ _id: string; name?: string; subthemeId?: string }>;
  };
}

const getNameById = (id: string, collection: any[] | undefined) => {
  if (!collection) return id;
  const item = collection.find(item => item._id === id);
  return item?.name || id;
};

export function DebugPanel({
  formData,
  mappedQuestionMode,
  availableQuestionCount,
  isCountLoading,
  hierarchicalData,
}: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [debugResults, setDebugResults] = useState<any>(null);
  const [isDebugging, setIsDebugging] = useState(false);

  const debugQuestionCollection = useMutation(
    api.customQuizzesCreation.debugQuestionCollection,
  );

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast({
      title: 'Copiado!',
      description: 'Dados copiados para o clipboard',
    });
  };

  const runDebugQuestions = async () => {
    setIsDebugging(true);
    try {
      const result = await debugQuestionCollection({
        questionMode: formData.questionMode as
          | 'all'
          | 'unanswered'
          | 'incorrect'
          | 'bookmarked',
        maxQuestions: formData.numQuestions,
        selectedThemes: formData.selectedThemes as any,
        selectedSubthemes: formData.selectedSubthemes as any,
        selectedGroups: formData.selectedGroups as any,
      });
      setDebugResults(result);
      toast({
        title: 'Debug Complete!',
        description: 'Question collection debug results are ready',
      });
    } catch (error) {
      console.error('Debug error:', error);
      toast({
        title: 'Debug Error',
        description: 'Failed to run debug. Check console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsDebugging(false);
    }
  };

  const formattedForSubmission = {
    testMode: formData.testMode,
    questionMode: mappedQuestionMode,
    numQuestions: formData.numQuestions,
    selectedThemes: formData.selectedThemes,
    selectedSubthemes: formData.selectedSubthemes,
    selectedGroups: formData.selectedGroups,
  };

  return (
    <Card className="border-orange-200 bg-orange-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-orange-100">
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Bug className="h-4 w-4" />
              Debug Panel (Dev Only)
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded border bg-white p-3">
                <div className="text-sm font-medium text-gray-600">
                  Available Questions
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {isCountLoading ? 'Loading...' : availableQuestionCount}
                </div>
              </div>
              <div className="rounded border bg-white p-3">
                <div className="text-sm font-medium text-gray-600">
                  Requested Count
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {formData.numQuestions}
                </div>
              </div>
            </div>

            {/* Form Values */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">
                  Current Form State
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(formData)}
                  className="h-7"
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
              </div>

              <div className="space-y-3 rounded border bg-white p-4">
                <div>
                  <span className="font-medium">Test Mode:</span>
                  <Badge variant="outline" className="ml-2">
                    {formData.testMode}
                  </Badge>
                </div>

                <div>
                  <span className="font-medium">Question Mode:</span>
                  <Badge variant="outline" className="ml-2">
                    {formData.questionMode}
                  </Badge>
                  <span className="ml-2 text-sm text-gray-500">
                    (Mapped: {JSON.stringify(mappedQuestionMode)})
                  </span>
                </div>

                <div>
                  <span className="font-medium">Question Count:</span>
                  <Badge variant="outline" className="ml-2">
                    {formData.numQuestions}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Selected IDs */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Selected IDs</h4>

              {/* Themes */}
              <div className="rounded border bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">
                    Themes ({formData.selectedThemes.length})
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(formData.selectedThemes)}
                    className="h-6 text-xs"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {formData.selectedThemes.length === 0 ? (
                    <span className="text-sm text-gray-500">None selected</span>
                  ) : (
                    formData.selectedThemes.map(id => (
                      <div key={id} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary">{id}</Badge>
                        <span className="text-gray-600">
                          {getNameById(id, hierarchicalData?.themes)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Subthemes */}
              <div className="rounded border bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">
                    Subthemes ({formData.selectedSubthemes.length})
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(formData.selectedSubthemes)}
                    className="h-6 text-xs"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {formData.selectedSubthemes.length === 0 ? (
                    <span className="text-sm text-gray-500">None selected</span>
                  ) : (
                    formData.selectedSubthemes.map(id => (
                      <div key={id} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary">{id}</Badge>
                        <span className="text-gray-600">
                          {getNameById(id, hierarchicalData?.subthemes)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Groups */}
              <div className="rounded border bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">
                    Groups ({formData.selectedGroups.length})
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(formData.selectedGroups)}
                    className="h-6 text-xs"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {formData.selectedGroups.length === 0 ? (
                    <span className="text-sm text-gray-500">None selected</span>
                  ) : (
                    formData.selectedGroups.map(id => (
                      <div key={id} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary">{id}</Badge>
                        <span className="text-gray-600">
                          {getNameById(id, hierarchicalData?.groups)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Formatted for Submission */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">
                  Data for Submission
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(formattedForSubmission)}
                  className="h-7"
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy JSON
                </Button>
              </div>
              <div className="overflow-x-auto rounded bg-gray-900 p-4 font-mono text-xs text-gray-100">
                <pre>{JSON.stringify(formattedForSubmission, null, 2)}</pre>
              </div>
            </div>

            {/* Debug Question Collection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">
                  Debug Question Collection
                </h4>
                <Button
                  onClick={runDebugQuestions}
                  disabled={isDebugging}
                  className="h-8 bg-blue-600 hover:bg-blue-700"
                >
                  <Play className="mr-1 h-3 w-3" />
                  {isDebugging ? 'Running...' : 'Debug Questions'}
                </Button>
              </div>

              {debugResults && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Debug Results
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(debugResults)}
                      className="h-6 text-xs"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Step-by-step breakdown */}
                  <div className="space-y-3">
                    {/* Step 1: Selected Entities */}
                    <div className="rounded border bg-white p-3">
                      <h5 className="mb-2 text-sm font-medium">
                        Step 1: Selected Entities
                      </h5>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="font-medium">Themes:</span>{' '}
                          {
                            debugResults.debugInfo.step1_selectedEntities.themes
                              .length
                          }
                        </div>
                        <div>
                          <span className="font-medium">Subthemes:</span>{' '}
                          {
                            debugResults.debugInfo.step1_selectedEntities
                              .subthemes.length
                          }
                        </div>
                        <div>
                          <span className="font-medium">Groups:</span>{' '}
                          {
                            debugResults.debugInfo.step1_selectedEntities.groups
                              .length
                          }
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Groups Processed */}
                    <div className="rounded border bg-white p-3">
                      <h5 className="mb-2 text-sm font-medium">
                        Step 2: Groups Processing
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="font-medium">Groups Queried:</span>{' '}
                          {
                            debugResults.debugInfo.step2_groupsProcessed
                              .groupsQueried.length
                          }
                        </div>
                        <div>
                          <span className="font-medium">Questions Found:</span>{' '}
                          {
                            debugResults.debugInfo.step2_groupsProcessed
                              .questionsFound
                          }
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Subthemes Processed */}
                    <div className="rounded border bg-white p-3">
                      <h5 className="mb-2 text-sm font-medium">
                        Step 3: Subthemes Processing
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="font-medium">
                            Subthemes Queried:
                          </span>{' '}
                          {
                            debugResults.debugInfo.step3_subthemesProcessed
                              .subthemesQueried.length
                          }
                        </div>
                        <div>
                          <span className="font-medium">
                            Subthemes Skipped:
                          </span>{' '}
                          {
                            debugResults.debugInfo.step3_subthemesProcessed
                              .subthemesSkipped.length
                          }
                        </div>
                        <div>
                          <span className="font-medium">Questions Found:</span>{' '}
                          {
                            debugResults.debugInfo.step3_subthemesProcessed
                              .questionsFound
                          }
                        </div>
                        {debugResults.debugInfo.step3_subthemesProcessed
                          .subthemesSkipped.length > 0 && (
                          <div className="mt-2">
                            <span className="font-medium text-orange-600">
                              Skipped Subthemes:
                            </span>
                            <div className="ml-2 space-y-1">
                              {debugResults.debugInfo.step3_subthemesProcessed.subthemesSkipped.map(
                                (skipped: any, idx: number) => (
                                  <div key={idx} className="text-orange-600">
                                    {skipped.subthemeId}: {skipped.reason}
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 4: Themes Processed */}
                    <div className="rounded border bg-white p-3">
                      <h5 className="mb-2 text-sm font-medium">
                        Step 4: Themes Processing
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="font-medium">Themes Queried:</span>{' '}
                          {
                            debugResults.debugInfo.step4_themesProcessed
                              .themesQueried.length
                          }
                        </div>
                        <div>
                          <span className="font-medium">Themes Skipped:</span>{' '}
                          {
                            debugResults.debugInfo.step4_themesProcessed
                              .themesSkipped.length
                          }
                        </div>
                        <div>
                          <span className="font-medium">Questions Found:</span>{' '}
                          {
                            debugResults.debugInfo.step4_themesProcessed
                              .questionsFound
                          }
                        </div>
                        {debugResults.debugInfo.step4_themesProcessed
                          .themesSkipped.length > 0 && (
                          <div className="mt-2">
                            <span className="font-medium text-orange-600">
                              Skipped Themes:
                            </span>
                            <div className="ml-2 space-y-1">
                              {debugResults.debugInfo.step4_themesProcessed.themesSkipped.map(
                                (skipped: any, idx: number) => (
                                  <div key={idx} className="text-orange-600">
                                    {skipped.themeId}: {skipped.reason}
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 5: Total Questions */}
                    <div className="rounded border bg-white p-3">
                      <h5 className="mb-2 text-sm font-medium">
                        Step 5: Total Unique Questions
                      </h5>
                      <div className="text-xs">
                        <span className="font-medium">
                          Total Questions Found:
                        </span>{' '}
                        {
                          debugResults.debugInfo.step5_totalQuestions
                            .totalUniqueQuestions
                        }
                      </div>
                    </div>

                    {/* Step 6: Mode Filtering */}
                    <div className="rounded border bg-white p-3">
                      <h5 className="mb-2 text-sm font-medium">
                        Step 6: Question Mode Filtering
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="font-medium">Mode:</span>{' '}
                          {
                            debugResults.debugInfo.step6_modeFiltering
                              .questionMode
                          }
                        </div>
                        <div>
                          <span className="font-medium">Before Filter:</span>{' '}
                          {
                            debugResults.debugInfo.step6_modeFiltering
                              .questionsBeforeFilter
                          }
                        </div>
                        <div>
                          <span className="font-medium">After Filter:</span>{' '}
                          {
                            debugResults.debugInfo.step6_modeFiltering
                              .questionsAfterFilter
                          }
                        </div>
                      </div>
                    </div>

                    {/* Step 7: Final Result */}
                    <div className="rounded border bg-green-50 p-3">
                      <h5 className="mb-2 text-sm font-medium">
                        Step 7: Final Result
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="font-medium">Requested:</span>{' '}
                          {
                            debugResults.debugInfo.step7_finalResult
                              .requestedQuestions
                          }
                        </div>
                        <div>
                          <span className="font-medium text-green-700">
                            Final Count:
                          </span>{' '}
                          {
                            debugResults.debugInfo.step7_finalResult
                              .finalQuestionCount
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Raw Debug Data */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium">Raw Debug Data</h5>
                    <div className="overflow-x-auto rounded bg-gray-900 p-4 font-mono text-xs text-gray-100">
                      <pre>{JSON.stringify(debugResults, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
