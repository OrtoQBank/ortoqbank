'use client';

import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';

type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

const statusConfig: Record<
  ReportStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: 'Pendente',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Clock,
  },
  reviewed: {
    label: 'Em análise',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Eye,
  },
  resolved: {
    label: 'Resolvido',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
  },
  dismissed: {
    label: 'Descartado',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: XCircle,
  },
};

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportStatus | 'all'>('pending');
  const [selectedReport, setSelectedReport] = useState<{
    _id: Id<'questionErrorReports'>;
    questionId: Id<'questions'>;
    questionCode?: string;
    questionTitle?: string;
    reporterEmail?: string;
    reporterName?: string;
    description: string;
    screenshotUrl?: string;
    status: ReportStatus;
    _creationTime: number;
  } | null>(null);
  const [newStatus, setNewStatus] = useState<ReportStatus>('pending');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const counts = useQuery(api.questionErrorReport.getReportCounts);
  const reports = useQuery(api.questionErrorReport.getReportsForAdmin, {
    status: activeTab === 'all' ? undefined : activeTab,
  });
  const updateStatus = useMutation(api.questionErrorReport.updateReportStatus);

  const handleUpdateStatus = async () => {
    if (!selectedReport) return;

    setIsUpdating(true);
    try {
      await updateStatus({
        reportId: selectedReport._id,
        status: newStatus,
        reviewNotes: reviewNotes.trim() || undefined,
      });

      toast({
        title: 'Status atualizado',
        description: 'O relatório foi atualizado com sucesso.',
      });

      setSelectedReport(null);
      setReviewNotes('');
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const openReportDetails = (report: NonNullable<typeof reports>[number]) => {
    setSelectedReport(report);
    setNewStatus(report.status);
    setReviewNotes('');
  };

  if (!counts) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-brand-blue"></div>
          <p className="text-muted-foreground">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-6 flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-amber-500" />
        <div>
          <h2 className="text-xl font-semibold">Relatórios de Problemas</h2>
          <p className="text-muted-foreground text-sm">
            Gerencie os problemas reportados pelos usuários nas questões
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Pendentes</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-900">{counts.pending}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Em análise</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-900">{counts.reviewed}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">Resolvidos</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-green-900">{counts.resolved}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-800">Descartados</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{counts.dismissed}</p>
        </div>
      </div>

      {/* Tabs for filtering */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportStatus | 'all')}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">Todos ({counts.total})</TabsTrigger>
          <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
          <TabsTrigger value="reviewed">Em análise ({counts.reviewed})</TabsTrigger>
          <TabsTrigger value="resolved">Resolvidos ({counts.resolved})</TabsTrigger>
          <TabsTrigger value="dismissed">Descartados ({counts.dismissed})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          {reports ? reports.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum relatório encontrado nesta categoria.
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const StatusIcon = statusConfig[report.status].icon;
                return (
                  <div
                    key={report._id}
                    className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={statusConfig[report.status].color}
                        >
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusConfig[report.status].label}
                        </Badge>
                        {report.screenshotUrl && (
                          <Badge variant="outline" className="gap-1">
                            <ImageIcon className="h-3 w-3" />
                            Imagem
                          </Badge>
                        )}
                        {report.questionCode && (
                          <span className="text-xs text-muted-foreground">
                            Código: {report.questionCode}
                          </span>
                        )}
                      </div>
                      <p className="mb-2 line-clamp-2 text-sm">{report.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Por: {report.reporterName || report.reporterEmail || 'Usuário'}
                        </span>
                        <span>•</span>
                        <span>{formatDate(report._creationTime)}</span>
                        {report.questionTitle && (
                          <>
                            <span>•</span>
                            <span className="max-w-[200px] truncate">
                              {report.questionTitle}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <Link href={`/admin/gerenciar-questoes/${report.questionId}`}>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="mr-1 h-4 w-4" />
                          Ver Questão
                        </Button>
                      </Link>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => openReportDetails(report)}
                      >
                        Gerenciar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Carregando...
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Report Details Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Detalhes do Relatório
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.questionCode
                ? `Questão: ${selectedReport.questionCode}`
                : 'Gerencie este relatório de problema'}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              {/* Reporter Info */}
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm font-medium">Reportado por</p>
                <p className="text-sm text-muted-foreground">
                  {selectedReport.reporterName || 'Nome não disponível'}
                  {selectedReport.reporterEmail && ` (${selectedReport.reporterEmail})`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(selectedReport._creationTime)}
                </p>
              </div>

              {/* Description */}
              <div>
                <p className="mb-2 text-sm font-medium">Descrição do Problema</p>
                <div className="rounded-lg border bg-white p-3">
                  <p className="whitespace-pre-wrap text-sm">{selectedReport.description}</p>
                </div>
              </div>

              {/* Screenshot */}
              {selectedReport.screenshotUrl && (
                <div>
                  <p className="mb-2 text-sm font-medium">Captura de Tela</p>
                  <a
                    href={selectedReport.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedReport.screenshotUrl}
                      alt="Screenshot"
                      className="max-h-60 rounded-lg border object-contain"
                    />
                  </a>
                </div>
              )}

              {/* Status Update */}
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Atualizar Status</p>
                <Select
                  value={newStatus}
                  onValueChange={(v) => setNewStatus(v as ReportStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        Pendente
                      </div>
                    </SelectItem>
                    <SelectItem value="reviewed">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-blue-500" />
                        Em análise
                      </div>
                    </SelectItem>
                    <SelectItem value="resolved">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Resolvido
                      </div>
                    </SelectItem>
                    <SelectItem value="dismissed">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-gray-500" />
                        Descartado
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Notas de Revisão (opcional)
                  </label>
                  <Textarea
                    placeholder="Adicione notas sobre a revisão..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Link href={`/admin/gerenciar-questoes/${selectedReport?.questionId}`}>
              <Button variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver Questão
              </Button>
            </Link>
            <Button onClick={handleUpdateStatus} disabled={isUpdating}>
              {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

