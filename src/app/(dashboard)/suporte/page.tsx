import {
  FileText,
  HelpCircle,
  Instagram,
  LayoutDashboard,
  Mail,
  Map,
  User,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-semibold">Suporte</h1>
        <p className="text-muted-foreground">
          Como usar o OrtoQBank da melhor forma para sua preparação
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <HelpCircle className="mt-1 h-6 w-6 flex-shrink-0 text-[#2096f4]" />
            <div>
              <h2 className="text-lg font-medium">
                Como usar o OrtoQBank da melhor forma
              </h2>
              <p className="text-muted-foreground mt-1">
                Bem-vindo ao OrtoQBank, seu parceiro estratégico na preparação
                para a prova da SBOT! Para aproveitar ao máximo a plataforma, é
                importante entender como cada área funciona:
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Map className="h-5 w-5 text-[#2096f4]" />
                <span>Trilhas de Estudo</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Ideal para quem está começando ou quer revisar com profundidade.
                Aqui, você encontrará questões inéditas, organizadas conforme os
                principais temas cobrados na SBOT, com base nos livros de
                referência. Cada questão vem com comentários detalhados e
                ilustrados, guiando você passo a passo no caminho do
                conhecimento.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-green-500" />
                <span>Simulados</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Treine em condições semelhantes às da prova! Nessa área, estão
                disponíveis provas anteriores da SBOT (TARO e TEOT) e simulados
                originais OrtoQBank. Todos com gabaritos comentados. É a
                ferramenta perfeita para medir seu desempenho e se familiarizar
                com o estilo da banca.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutDashboard className="h-5 w-5 text-purple-500" />
                <span>Testes Personalizados</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Quer focar em temas específicos? Aqui você pode criar seus
                próprios testes, escolhendo temas, subtemas e grupos. Ideal para
                revisar pontos fracos ou reforçar áreas-chave. Além disso, você
                pode rever testes anteriores para acompanhar sua evolução.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-amber-500" />
                <span>Meu Perfil</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Acompanhe seu progresso! A aba &quot;Meu Perfil&quot; oferece
                feedback detalhado, com estatísticas de desempenho e uso da
                plataforma, ajudando você a definir metas e otimizar seus
                estudos.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contato</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              Caso tenha alguma dúvida ou sugestão, ficamos à disposição nos
              contatos:
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="mailto:ortoqbank@gmail.com"
                className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm transition-colors hover:bg-slate-200"
              >
                <Mail className="h-4 w-4" />
                <span>ortoqbank@gmail.com</span>
              </a>
              <a
                href="https://instagram.com/ortoqbank"
                className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm transition-colors hover:bg-slate-200"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram className="h-4 w-4" />
                <span>@ortoqbank</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
