'use client';

import { useMutation, useQuery } from 'convex/react';
import {
  BarChart3,
  BookOpen,
  Database,
  Loader2,
  Play,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

import { api } from '../../../../convex/_generated/api';

export default function DemoPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSimpleBackfillRunning, setIsSimpleBackfillRunning] = useState(false);
  const [isBatchedBackfillRunning, setIsBatchedBackfillRunning] =
    useState(false);

  const { toast } = useToast();

  // Queries for question count data
  const allQuestionCounts = useQuery(api.aggregateQueries.getAllQuestionCounts);
  const questionCountsByMode = useQuery(api.questions.countQuestionsByMode, {
    questionMode: 'all',
  });
  const backfillInfo = useQuery(api.questions.getBackfillInfo);

  // Get themes for the theme breakdown
  const themes = useQuery(api.themes.list);

  // Mutations for backfill operations
  const triggerSimpleBackfill = useMutation(
    api.questions.triggerSimpleBackfill,
  );
  const triggerBatchedBackfill = useMutation(
    api.questions.triggerBatchedBackfill,
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Force a refresh by invalidating queries
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleSimpleBackfill = async () => {
    setIsSimpleBackfillRunning(true);
    try {
      const result = await triggerSimpleBackfill({});
      if (result.success) {
        toast({
          title: 'Backfill Started',
          description: result.message,
        });
      } else {
        toast({
          title: 'Backfill Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to start simple backfill',
        variant: 'destructive',
      });
    } finally {
      setIsSimpleBackfillRunning(false);
    }
  };

  const handleBatchedBackfill = async () => {
    setIsBatchedBackfillRunning(true);
    try {
      const result = await triggerBatchedBackfill({ batchSize: 500 });
      if (result.success) {
        toast({
          title: 'Batched Backfill Started',
          description: result.message,
        });
      } else {
        toast({
          title: 'Backfill Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to start batched backfill',
        variant: 'destructive',
      });
    } finally {
      setIsBatchedBackfillRunning(false);
    }
  };

  // Calculate summary stats
  const totalCombinations = allQuestionCounts?.length || 0;
  const totalQuestionsInCounts =
    allQuestionCounts?.reduce((sum, count) => sum + count.questionCount, 0) ||
    0;
  const totalQuestions = questionCountsByMode?.all || 0;

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Question Count Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor question distribution across themes, subthemes, and groups
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Questions
            </CardTitle>
            <BookOpen className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalQuestions.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">
              All questions in database
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Counted Questions
            </CardTitle>
            <Database className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalQuestionsInCounts.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">
              Questions with theme classification
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxonomy Combinations
            </CardTitle>
            <BarChart3 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCombinations}</div>
            <p className="text-muted-foreground text-xs">
              Theme/Subtheme/Group combos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalQuestions > 0
                ? Math.round((totalQuestionsInCounts / totalQuestions) * 100)
                : 0}
              %
            </div>
            <p className="text-muted-foreground text-xs">
              Questions with complete classification
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="detailed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="detailed">Detailed Counts</TabsTrigger>
          <TabsTrigger value="themes">By Theme</TabsTrigger>
          <TabsTrigger value="backfill">Backfill Tools</TabsTrigger>
        </TabsList>

        {/* Detailed Counts Tab */}
        <TabsContent value="detailed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Question Counts by Theme/Subtheme/Group</CardTitle>
              <CardDescription>
                Detailed breakdown of questions by theme, subtheme, and group
                combinations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allQuestionCounts ? (
                allQuestionCounts.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Theme</TableHead>
                          <TableHead>Subtheme</TableHead>
                          <TableHead>Group</TableHead>
                          <TableHead className="text-right">
                            Question Count
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allQuestionCounts.map(count => (
                          <TableRow
                            key={`${count.themeId}-${count.subthemeId}-${count.groupId}`}
                          >
                            <TableCell className="font-medium">
                              {count.themeName || 'Unknown Theme'}
                            </TableCell>
                            <TableCell>
                              {count.subthemeName || 'Unknown Subtheme'}
                            </TableCell>
                            <TableCell>
                              {count.groupName || 'Unknown Group'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">
                                {count.questionCount}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Database className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                      <p className="text-muted-foreground mb-2">
                        No question counts found
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Run a backfill to populate the count data
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Database className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                    <p className="text-muted-foreground">
                      Loading question counts...
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Theme Tab */}
        <TabsContent value="themes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Question Counts by Theme</CardTitle>
              <CardDescription>
                Aggregated view of questions grouped by theme
              </CardDescription>
            </CardHeader>
            <CardContent>
              {themes && allQuestionCounts ? (
                <div className="space-y-4">
                  {themes.map(theme => {
                    const themeCounts = allQuestionCounts.filter(
                      count => count.themeId === theme._id,
                    );
                    const totalForTheme = themeCounts.reduce(
                      (sum, count) => sum + count.questionCount,
                      0,
                    );

                    return (
                      <div key={theme._id} className="rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-lg font-semibold">
                            {theme.name}
                          </h3>
                          <Badge variant="outline">
                            {totalForTheme} questions
                          </Badge>
                        </div>

                        {themeCounts.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                            {themeCounts.map(count => (
                              <div
                                key={`${count.subthemeId}-${count.groupId}`}
                                className="bg-muted flex items-center justify-between rounded p-2"
                              >
                                <div className="text-sm">
                                  <span className="font-medium">
                                    {count.subthemeName}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {' '}
                                    / {count.groupName}
                                  </span>
                                </div>
                                <Badge variant="secondary">
                                  {count.questionCount}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            No questions with complete classification
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <BarChart3 className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                    <p className="text-muted-foreground">
                      Loading theme data...
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backfill Tools Tab */}
        <TabsContent value="backfill" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Backfill Tools</CardTitle>
              <CardDescription>
                Tools to initialize and maintain question count data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-semibold">Simple Backfill</h4>
                  <p className="text-muted-foreground mb-3 text-sm">
                    For smaller datasets (&lt; 1,000 questions). Processes all
                    questions at once.
                  </p>
                  <Button
                    onClick={handleSimpleBackfill}
                    disabled={isSimpleBackfillRunning}
                    variant="outline"
                    className="w-full"
                  >
                    {isSimpleBackfillRunning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Run Simple Backfill
                      </>
                    )}
                  </Button>
                </div>

                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-semibold">Batched Backfill</h4>
                  <p className="text-muted-foreground mb-3 text-sm">
                    For large datasets (1,000+ questions). Processes in safe
                    batches.
                  </p>
                  <Button
                    onClick={handleBatchedBackfill}
                    disabled={isBatchedBackfillRunning}
                    variant="outline"
                    className="w-full"
                  >
                    {isBatchedBackfillRunning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Start Batched Backfill
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold">System Information</h4>
                {backfillInfo ? (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Total Questions:</span>
                      <span className="ml-2">
                        {backfillInfo.totalQuestions.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">With Theme:</span>
                      <span className="ml-2">
                        {backfillInfo.questionsWithTheme.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Missing Theme:</span>
                      <span className="ml-2">
                        {(
                          backfillInfo.totalQuestions -
                          backfillInfo.questionsWithTheme
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Count Entries:</span>
                      <span className="ml-2">
                        {backfillInfo.countEntries.toLocaleString()}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">Coverage:</span>
                      <span className="ml-2">
                        {backfillInfo.coverage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    Loading system information...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
