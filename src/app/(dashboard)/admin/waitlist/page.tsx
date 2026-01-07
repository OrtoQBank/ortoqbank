'use client';

import { Download, Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

import { useSession } from '@/components/providers/SessionProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTenantQuery } from '@/hooks/useTenantQuery';

import { api } from '../../../../../convex/_generated/api';

export default function WaitlistPage() {
  const router = useRouter();
  const { isAdmin, isLoading: sessionLoading } = useSession();

  // Redirect non-super-admins
  useEffect(() => {
    if (!sessionLoading && !isAdmin) {
      router.push('/admin');
    }
  }, [sessionLoading, isAdmin, router]);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const entries = useTenantQuery(api.waitlist.list, {});
  const isLoading = entries === undefined;

  // Filter entries based on search query
  const filteredEntries = (entries ?? []).filter(entry => {
    if (!searchQuery.trim()) return true;
    const search = searchQuery.toLowerCase();
    return (
      entry.name.toLowerCase().includes(search) ||
      entry.email.toLowerCase().includes(search) ||
      entry.whatsapp.toLowerCase().includes(search) ||
      entry.instagram?.toLowerCase().includes(search)
    );
  });

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleExportToExcel = () => {
    if (!entries || entries.length === 0) return;

    // Prepare data for Excel
    const excelData = filteredEntries.map(entry => ({
      Nome: entry.name,
      Email: entry.email,
      WhatsApp: entry.whatsapp,
      Instagram: entry.instagram ?? '',
      'Nivel Residencia': entry.residencyLevel,
      Subespecialidade: entry.subspecialty,
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista de Espera');

    // Generate file name with current date
    const date = new Date().toISOString().split('T')[0];
    const fileName = `waitlist-ortoqbank-${date}.xlsx`;

    // Download file
    XLSX.writeFile(wb, fileName);
  };

  // Show loading while checking permissions
  if (sessionLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Don't render if not admin (will redirect)
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6 p-0 md:p-6">
      <h1 className="text-2xl font-bold">Lista de Espera</h1>

      {/* Search Input and Export Button */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por nome, email, WhatsApp ou Instagram..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="max-w-md"
        />
        <Button onClick={handleSearch} size="default">
          <Search className="mr-2 h-4 w-4" />
          Buscar
        </Button>
        <Button
          onClick={handleExportToExcel}
          variant="outline"
          size="icon"
          disabled={isLoading || filteredEntries.length === 0}
          title="Exportar para Excel"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Instructions */}
      <p className="text-muted-foreground text-sm">
        {isLoading
          ? 'Carregando...'
          : searchQuery.trim()
            ? `Mostrando ${filteredEntries.length} resultado(s) da busca.`
            : `Total de ${(entries ?? []).length} inscricao(oes) na lista de espera.`}
      </p>

      {/* Entries Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead>Nivel Residencia</TableHead>
              <TableHead>Subespecialidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-6 text-center"
                >
                  Carregando inscricoes...
                </TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-6 text-center"
                >
                  {searchQuery.trim()
                    ? 'Nenhuma inscricao encontrada'
                    : 'Nenhuma inscricao na lista de espera'}
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map(entry => (
                <TableRow key={entry._id}>
                  <TableCell className="font-medium">{entry.name}</TableCell>
                  <TableCell>{entry.email}</TableCell>
                  <TableCell>{entry.whatsapp}</TableCell>
                  <TableCell>
                    {entry.instagram ? `@${entry.instagram}` : '-'}
                  </TableCell>
                  <TableCell>{entry.residencyLevel}</TableCell>
                  <TableCell>{entry.subspecialty}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
