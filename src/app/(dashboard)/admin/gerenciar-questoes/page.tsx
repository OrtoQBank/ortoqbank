'use client';

import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';

export default function GerenciarQuestoes() {
  const router = useRouter();
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<Id<'questions'> | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [questionToDelete, setQuestionToDelete] = useState<{
    id: Id<'questions'>;
    title: string;
  } | null>(null);

  const deleteQuestion = useMutation(api.questions.deleteQuestion);
  const { results, status, loadMore } = usePaginatedQuery(
    api.questions.list,
    {},
    { initialNumItems: 10 },
  );

  // Use the searchByCode query when search is provided, otherwise show nothing
  const searchResults =
    useQuery(
      api.questions.searchByCode,
      searchQuery.trim() ? { code: searchQuery, limit: 10 } : 'skip',
    ) || [];

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleClear = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  const handleView = (questionId: Id<'questions'>) => {
    router.push(`/admin/gerenciar-questoes/${questionId}`);
  };

  const handleDelete = (questionId: Id<'questions'>, questionTitle: string) => {
    setQuestionToDelete({ id: questionId, title: questionTitle });
  };

  const confirmDelete = async () => {
    if (!questionToDelete) return;

    setDeletingId(questionToDelete.id);
    try {
      await deleteQuestion({ id: questionToDelete.id });
      toast({
        title: 'Sucesso',
        description: 'Questão excluída com sucesso!',
      });
      // Refresh the search results by incrementing the refresh key
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Erro ao excluir questão:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a questão.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
      setQuestionToDelete(null);
    }
  };

  return (
    <div className="space-y-6 p-0 md:p-6">
      <h1 className="text-2xl font-bold">Gerenciar Questões</h1>

      {/* Search Input */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por código ou título da questão..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="max-w-md"
        />
        <Button onClick={handleSearch}>Buscar</Button>
        {searchInput && (
          <Button variant="ghost" onClick={handleClear}>
            Limpar
          </Button>
        )}
      </div>

      {/* Search Instructions */}
      <p className="text-muted-foreground text-sm">
        {searchQuery.trim()
          ? 'Mostrando resultados da busca (máximo 10 resultados).'
          : 'Mostrando todas as questões. Use a busca para filtrar por código ou título.'}
      </p>

      {/* Questions Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Tema</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {searchQuery.trim() ? (
              searchResults.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-muted-foreground py-6 text-center"
                  >
                    Nenhuma questão encontrada com este código
                  </TableCell>
                </TableRow>
              ) : (
                searchResults.map(question => (
                  <TableRow key={question._id}>
                    <TableCell className="font-medium">
                      {question.questionCode || 'Sem código'}
                    </TableCell>
                    <TableCell>{question.title}</TableCell>
                    <TableCell>
                      {question.theme
                        ? question.theme.name
                        : 'Tema não encontrado'}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(question._id)}
                      >
                        Visualizar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          handleDelete(question._id, question.title)
                        }
                        disabled={deletingId === question._id}
                      >
                        {deletingId === question._id
                          ? 'Excluindo...'
                          : 'Excluir'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )
            ) : status === 'LoadingFirstPage' ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground py-6 text-center"
                >
                  Carregando questões...
                </TableCell>
              </TableRow>
            ) : results.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground py-6 text-center"
                >
                  Nenhuma questão encontrada
                </TableCell>
              </TableRow>
            ) : (
              results.map(question => (
                <TableRow key={question._id}>
                  <TableCell className="font-medium">
                    {question.questionCode || 'Sem código'}
                  </TableCell>
                  <TableCell>{question.title}</TableCell>
                  <TableCell>
                    {question.theme
                      ? question.theme.name
                      : 'Tema não encontrado'}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(question._id)}
                    >
                      Visualizar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        handleDelete(question._id, question.title)
                      }
                      disabled={deletingId === question._id}
                    >
                      {deletingId === question._id
                        ? 'Excluindo...'
                        : 'Excluir'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Load More Button */}
      {!searchQuery.trim() && status === 'CanLoadMore' && (
        <div className="flex justify-center">
          <Button onClick={() => loadMore(10)} variant="outline">
            Carregar mais
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!questionToDelete}
        onOpenChange={open => !open && setQuestionToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Questão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a questão &ldquo;
              {questionToDelete?.title}&rdquo;?
              <br />
              <br />
              Esta ação removerá a questão de todos os testes/trilhas que a
              contêm e não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQuestionToDelete(null)}
              disabled={!!deletingId}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={!!deletingId}
            >
              {deletingId ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
