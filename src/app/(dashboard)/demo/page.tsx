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
  const [isClearRecalculateRunning, setIsClearRecalculateRunning] = 
    useState(false);

  const { toast } = useToast();

  // Queries for question count data
  const allQuestionCounts = useQuery(api.questions.getAllQuestionCounts);
  const questionCountsByMode = useQuery(api.questions.countQuestionsByMode, {
    questionMode: 'all',
  });
  const backfillInfo = useQuery(api.questions.getBackfillInfo);

  // Get themes, subthemes, and groups for the breakdown
  const themes = useQuery(api.themes.list);
  const subthemes = useQuery(api.subthemes.list);
  const groups = useQuery(api.groups.list);

  // Mutations for backfill operations
  const triggerSimpleBackfill = useMutation(
    api.questions.triggerSimpleBackfill,
  );
  const triggerBatchedBackfill = useMutation(
    api.questions.triggerBatchedBackfill,
  );
  const triggerClearAndRecalculate = useMutation(
    api.questions.triggerClearAndRecalculate,
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

  const handleClearAndRecalculate = async () => {
    setIsClearRecalculateRunning(true);
    try {
      const result = await triggerClearAndRecalculate({});
      if (result.success) {
        toast({
          title: 'Clear & Recalculate Started',
          description: result.message,
        });
      } else {
        toast({
          title: 'Clear & Recalculate Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to start clear and recalculate',
        variant: 'destructive',
      });
    } finally {
      setIsClearRecalculateRunning(false);
    }
  };

  // Calculate summary stats
  const totalCombinations = allQuestionCounts?.length || 0;
  
  // Only count questions at the group level (most specific) to avoid triple-counting
  // since we now store counts at theme, theme+subtheme, and theme+subtheme+group levels
  const totalQuestionsInCounts =
    allQuestionCounts?.filter(count => 
      count.groupId != null && count.groupId !== undefined && 
      count.subthemeId != null && count.subthemeId !== undefined
    ).reduce((sum, count) => sum + count.questionCount, 0) || 0;
  
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
              Questions with complete theme+subtheme+group classification
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
          <TabsTrigger value="taxonomy">Taxonomy Counts</TabsTrigger>
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

        {/* Taxonomy Counts Tab */}
        <TabsContent value="taxonomy" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Theme Counts */}
            <Card>
              <CardHeader>
                <CardTitle>Theme Counts</CardTitle>
                <CardDescription>
                  Questions per theme (all questions with themeId)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {themes && allQuestionCounts ? (
                  <div className="space-y-2">
                    {themes.map(theme => {
                      // Find theme-level count (subthemeId = null/undefined, groupId = null/undefined)
                      const themeCount = allQuestionCounts.find(
                        count => count.themeId === theme._id && 
                                (count.subthemeId == null || count.subthemeId === undefined) && 
                                (count.groupId == null || count.groupId === undefined)
                      );
                      
                      return (
                        <div key={theme._id} className="flex items-center justify-between py-2 border-b">
                          <div className="font-medium text-sm">
                            {theme.name}
                          </div>
                          <Badge variant="secondary">
                            {themeCount?.questionCount || 0}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">Loading themes...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subtheme Counts */}
            <Card>
              <CardHeader>
                <CardTitle>Subtheme Counts</CardTitle>
                <CardDescription>
                  Questions per subtheme (themeId + subthemeId)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {subthemes && allQuestionCounts ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {subthemes.map(subtheme => {
                      // Find subtheme-level count (groupId = null/undefined)
                      const subthemeCount = allQuestionCounts.find(
                        count => count.themeId === subtheme.themeId && 
                                count.subthemeId === subtheme._id && 
                                (count.groupId == null || count.groupId === undefined)
                      );
                      
                      return (
                        <div key={subtheme._id} className="flex items-center justify-between py-2 border-b">
                          <div className="font-medium text-sm">
                            {subtheme.name}
                          </div>
                          <Badge variant="secondary">
                            {subthemeCount?.questionCount || 0}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">Loading subthemes...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Group Counts */}
            <Card>
              <CardHeader>
                <CardTitle>Group Counts</CardTitle>
                <CardDescription>
                  Questions per group (themeId + subthemeId + groupId)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {groups && allQuestionCounts ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {groups.map(group => {
                      // Find group-level count (all three IDs present)
                      const groupCount = allQuestionCounts.find(
                        count => count.subthemeId === group.subthemeId && 
                                count.groupId === group._id
                      );
                      
                      return (
                        <div key={group._id} className="flex items-center justify-between py-2 border-b">
                          <div className="font-medium text-sm">
                            {group.name}
                          </div>
                          <Badge variant="secondary">
                            {groupCount?.questionCount || 0}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">Loading groups...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
              <div className="rounded-lg border p-4 mb-4">
                <h4 className="mb-2 font-semibold text-green-700">✨ Clear & Recalculate (Recommended)</h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  <strong>Clears all existing counts and recalculates exact counts from the database.</strong> 
                  This is the most accurate method and should be used to fix any counting issues.
                </p>
                <Button
                  onClick={handleClearAndRecalculate}
                  disabled={isClearRecalculateRunning}
                  variant="default"
                  className="w-full"
                >
                  {isClearRecalculateRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running Clear & Recalculate...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Clear & Recalculate All Counts
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-semibold">Simple Backfill (Legacy)</h4>
                  <p className="text-muted-foreground mb-3 text-sm">
                    For smaller datasets (&lt; 1,000 questions). Now uses the clear & recalculate method.
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
                  <h4 className="mb-2 font-semibold">Batched Backfill (Legacy)</h4>
                  <p className="text-muted-foreground mb-3 text-sm">
                    For large datasets (1,000+ questions). Processes in safe
                    batches but may accumulate incorrect counts.
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
