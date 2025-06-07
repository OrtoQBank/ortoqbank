'use client';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TermsOfServiceModalProps {
  open: boolean;
  onAccept: () => void;
  isLoading?: boolean;
}

export function TermsOfServiceModal({
  open,
  onAccept,
  isLoading = false,
}: TermsOfServiceModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ensure scroll position resets when modal opens
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [open]);

  return (
    <Dialog open={open}>
      <DialogContent className="flex max-h-[80vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Termos de Uso do OrtoQBank
          </DialogTitle>
          <DialogDescription>
            Por favor, leia e aceite os termos de uso para continuar utilizando
            o OrtoQBank.
          </DialogDescription>
        </DialogHeader>

        {/* Custom scroll implementation without shadcn ScrollArea */}
        <div
          ref={scrollRef}
          className="prose prose-sm dark:prose-invert max-w-none flex-1 overflow-y-auto px-4 py-2"
          style={{
            height: '400px',
            scrollbarWidth: 'thin',
            scrollbarColor: '#888 #f1f1f1',
          }}
        >
          <h2 className="mb-3 text-xl font-bold">Introdução</h2>
          <p>
            Bem-vindo ao OrtoQBank. Este documento de Termos e Condições de Uso
            (&ldquo;Termos de Uso&rdquo;) rege o acesso e a utilização do
            produto OrtoQBank, um banco de questões de Ortopedia com gabarito
            comentado, oferecido online aos candidatos à prova de título de
            especialista em Ortopedia (SBOT). Ao adquirir o acesso ao OrtoQBank
            e criar uma conta, você (doravante denominado &ldquo;Usuário&rdquo;)
            declara ter lido, compreendido e aceitado integralmente estes Termos
            de Uso.
          </p>

          <h2 className="mt-6 mb-3 text-xl font-bold">Condições de Uso</h2>
          <p className="mb-4">
            <span className="font-semibold">Uso Pessoal e Intransferível:</span>{' '}
            O acesso ao OrtoQBank é fornecido ao Usuário de forma pessoal e
            intransferível. É estritamente proibida a reprodução, revenda,
            distribuição ou compartilhamento, total ou parcial, de qualquer
            conteúdo disponibilizado na plataforma, sem autorização expressa e
            por escrito da OrtoQBank. O conteúdo é destinado exclusivamente ao
            uso individual do Usuário para fins de estudo e preparação para a
            prova da SBOT.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Conformidade Legal:</span> O Usuário
            concorda em utilizar o OrtoQBank de maneira ética e dentro da
            legalidade, comprometendo-se a não empregar o serviço para fins
            ilícitos ou que contrariem estes Termos de Uso. Qualquer tentativa
            de burlar sistemas de segurança, acessar informações de terceiros ou
            obter o conteúdo de forma indevida é expressamente vedada e poderá
            resultar no encerramento imediato do acesso, sem prejuízo das
            medidas legais cabíveis.
          </p>
          <p className="mb-4">
            <span className="font-semibold">
              Nenhuma Garantia de Resultado:
            </span>{' '}
            O OrtoQBank é um instrumento de estudo e reforço acadêmico. Embora
            nosso objetivo seja oferecer questões de qualidade com gabaritos
            comentados para auxiliar na preparação, não garantimos qualquer
            resultado específico no exame de título de especialista em
            Ortopedia. A responsabilidade pelo desempenho na prova é exclusiva
            do Usuário.
          </p>

          <h2 className="mt-6 mb-3 text-xl font-bold">
            Responsabilidade do Usuário
          </h2>
          <p className="mb-2">
            O Usuário assume as seguintes responsabilidades ao utilizar o
            OrtoQBank:
          </p>
          <p className="mb-4">
            <span className="font-semibold">Veracidade das Informações:</span>{' '}
            Fornecer dados cadastrais verdadeiros e atualizados no momento da
            criação da conta e da compra do acesso. O Usuário é responsável por
            manter seus dados de contato (como e-mail e telefone) atualizados
            para recebimento de informações importantes sobre o serviço.
          </p>
          <p className="mb-4">
            <span className="font-semibold">
              Confidencialidade de Credenciais:
            </span>{' '}
            Manter em sigilo seu login e senha de acesso. Essas credenciais são
            de uso pessoal e não devem ser compartilhadas com terceiros. O
            Usuário é integralmente responsável por quaisquer atividades
            realizadas em sua conta. Em caso de suspeita de acesso não
            autorizado ou comprometimento da senha, o Usuário deverá notificar
            imediatamente a OrtoQBank para que sejam tomadas as devidas
            providências.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Uso Adequado do Conteúdo:</span>{' '}
            Utilizar o conteúdo do OrtoQBank apenas para estudo pessoal. É
            vedado ao Usuário copiar, reproduzir, publicar, compartilhar ou
            distribuir as questões, respostas comentadas, textos, imagens ou
            qualquer material do OrtoQBank em qualquer meio (digital ou físico)
            sem autorização. Também não é permitido utilizar o conteúdo para
            criar obras derivadas, compilações ou produtos concorrentes.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Equipamentos e Conexão:</span>{' '}
            Garantir que possui os equipamentos (computador, smartphone, etc.) e
            conexão à internet necessários para acessar a plataforma. A
            OrtoQBank não será responsável por impossibilidades de acesso
            decorrentes de problemas do dispositivo do Usuário, falhas de
            provedor de internet ou configurações fora dos requisitos mínimos do
            sistema.
          </p>

          <h2 className="mt-6 mb-3 text-xl font-bold">
            Propriedade Intelectual
          </h2>
          <p className="mb-4">
            <span className="font-semibold">Direitos Autorais:</span> Todo o
            conteúdo disponibilizado no OrtoQBank (incluindo, mas não se
            limitando a, questões, explicações, comentários de gabarito, textos,
            imagens, layout, logotipos e marcas) é de propriedade intelectual da
            OrtoQBank ou de seus licenciantes, sendo protegido pela legislação
            de direitos autorais e de propriedade intelectual aplicável (Lei
            Federal nº 9.610/98 e demais normas pertinentes). O simples fato de
            o Usuário ter adquirido acesso ao OrtoQBank não lhe confere nenhum
            direito de propriedade sobre esse conteúdo, mas apenas uma licença
            de uso limitada, nos termos estabelecidos neste documento.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Licença de Uso Limitada:</span> O
            Usuário recebe uma licença não exclusiva, limitada, revogável e
            intransferível para acessar e utilizar o OrtoQBank durante o período
            de validade da assinatura (conforme definido na seção &ldquo;Acesso
            e Suporte&rdquo;). Essa licença tem por único objetivo permitir o
            uso pessoal do serviço pelo Usuário, nos exatos termos previstos
            nestes Termos de Uso.
          </p>
          <p className="mb-4">
            <span className="font-semibold">
              Vedação de Uso Não Autorizado:
            </span>{' '}
            Qualquer uso do conteúdo em desacordo com estes Termos, incluindo
            reprodução, armazenamento, distribuição, transmissão, exibição ou
            execução pública do conteúdo do OrtoQBank sem permissão, constitui
            violação dos direitos de propriedade intelectual da empresa. O
            Usuário está ciente de que o uso indevido do conteúdo poderá
            sujeitá-lo às responsabilizações civis e penais cabíveis, nos termos
            da legislação brasileira.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Marcas e Sinais Distintivos:</span>{' '}
            As marcas, nomes comerciais ou logotipos presentes no OrtoQBank são
            de titularidade da empresa proprietária do OrtoQBank. É vedada a
            utilização de quaisquer desses sinais distintivos pelo Usuário,
            exceto com prévia autorização por escrito.
          </p>

          <h2 className="mt-6 mb-3 text-xl font-bold">Acesso e Suporte</h2>
          <p className="mb-4">
            <span className="font-semibold">Credenciais de Acesso:</span> O
            acesso ao OrtoQBank é realizado mediante credenciais (login e senha)
            criadas pelo Usuário no momento da compra. Essas credenciais são
            pessoais e intransferíveis, vinculadas ao CPF ou identificação do
            Usuário. Somente o adquirente está autorizado a utilizar essas
            credenciais para ingressar na plataforma.
          </p>
          <p className="mb-4">
            <span className="font-semibold">
              Período de Validade do Acesso:
            </span>{' '}
            O Usuário terá direito de acesso ao OrtoQBank por tempo limitado, ou
            seja, até a data da prova de título de especialista em Ortopedia
            (SBOT) do ano em que foi realizada a compra. Após essa data, o
            acesso à plataforma será automaticamente encerrado,
            independentemente do aproveitamento ou não do conteúdo pelo Usuário.
            Para continuidade de acesso após esse prazo, será necessária nova
            aquisição, sujeita a termos e condições vigentes à época.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Suporte Técnico:</span> A OrtoQBank
            disponibiliza suporte técnico aos Usuários para esclarecimento de
            dúvidas, solução de problemas de acesso ou utilização da plataforma.
            O suporte será prestado por meio dos canais oficiais de comunicação
            indicados no site (como endereço de e-mail ou chat de atendimento),
            durante os horários comerciais. O Usuário deverá informar
            corretamente seus dados e descrever o problema encontrado ao acionar
            o suporte, para que o atendimento seja eficiente.
          </p>
          <p className="mb-4">
            <span className="font-semibold">
              Manutenções e Disponibilidade:
            </span>{' '}
            A OrtoQBank envida seus melhores esforços para manter a plataforma
            em funcionamento e acessível 24 (vinte e quatro) horas por dia. No
            entanto, poderão ocorrer interrupções temporárias para manutenções,
            atualizações ou por motivos de força maior (como falhas de
            infraestrutura, ataques virtuais, casos fortuitos etc.). A OrtoQBank
            não será responsabilizada por indisponibilidades temporárias do
            serviço, mas se compromete a empregar medidas razoáveis para
            restabelecer o acesso o mais breve possível.
          </p>

          <h2 className="mt-6 mb-3 text-xl font-bold">Política de Reembolso</h2>
          <p className="mb-2">
            Em respeito à legislação de defesa do consumidor e ao direito de
            arrependimento previsto no Código de Defesa do Consumidor (Lei
            Federal nº 8.078/90), a OrtoQBank adota a seguinte política de
            reembolso:
          </p>
          <p className="mb-4">
            <span className="font-semibold">Prazo de Arrependimento:</span> O
            Usuário poderá desistir da compra e solicitar o reembolso integral
            do valor pago em até 7 (sete) dias corridos contados a partir da
            data da contratação (data da compra do acesso), conforme o art. 49
            do CDC.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Procedimento para Reembolso:</span>{' '}
            Para exercer o direito de arrependimento, o Usuário deverá entrar em
            contato com o suporte da OrtoQBank dentro do prazo de 7 dias, por
            meio dos canais oficiais de atendimento, solicitando expressamente o
            cancelamento do serviço e o reembolso. Será necessário fornecer os
            dados da compra (como nome, e-mail cadastrado e número do pedido)
            para que a solicitação seja processada.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Condições do Reembolso:</span> Uma
            vez recebido o pedido de cancelamento dentro do prazo legal e
            confirmados os dados, a OrtoQBank irá realizar o reembolso do valor
            pago pelo Usuário, preferencialmente utilizando o mesmo meio de
            pagamento original. O acesso do Usuário ao OrtoQBank será encerrado
            assim que o cancelamento for efetivado. O reembolso poderá levar
            alguns dias para ser processado pela instituição financeira ou
            operadora de pagamento, a depender dos procedimentos de terceiros.
          </p>
          <p className="mb-4">
            <span className="font-semibold">
              Expiração do Direito de Arrependimento:
            </span>{' '}
            Decorrido o prazo de 7 dias sem que o Usuário tenha solicitado o
            cancelamento, a compra será considerada definitiva e não será
            possível a devolução dos valores pagos, salvo disposição em
            contrário expressa pela OrtoQBank em situações excepcionais.
          </p>

          <h2 className="mt-6 mb-3 text-xl font-bold">
            Atualizações do Conteúdo
          </h2>
          <p className="mb-4">
            <span className="font-semibold">Critério de Atualização:</span> A
            inclusão de novas questões, revisões ou atualizações no banco de
            questões do OrtoQBank será realizada a critério exclusivo da equipe
            da OrtoQBank. Não há obrigatoriedade de atualização contínua ou
            periódica do conteúdo durante o período de acesso contratado. As
            atualizações, quando efetuadas, têm o objetivo de manter o banco de
            questões relevante e útil, mas são fornecidas por mera liberalidade
            da OrtoQBank.
          </p>
          <p className="mb-4">
            <span className="font-semibold">
              Sem Garantia de Novos Conteúdos:
            </span>{' '}
            A aquisição do acesso ao OrtoQBank não garante ao Usuário o direito
            a receber acréscimos ou novos conteúdos além daqueles já
            disponibilizados no momento da compra. O Usuário compreende que o
            banco de questões já inclui um acervo substancial de perguntas com
            gabarito comentado e que eventuais ampliações desse acervo ocorrerão
            conforme a estratégia de atualização da OrtoQBank.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Modificações na Plataforma:</span>{' '}
            Além do conteúdo, a OrtoQBank poderá implementar melhorias ou
            alterações na plataforma (por exemplo, funcionalidades, interface,
            disposição das informações) visando aprimorar a experiência do
            Usuário. Tais modificações também são discricionárias e não
            obrigatórias.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Comunicação de Atualizações:</span>{' '}
            A OrtoQBank pode, a seu critério, informar os Usuários sobre
            atualizações relevantes no conteúdo ou na plataforma, seja por meio
            de avisos dentro do próprio sistema, seja via e-mail cadastrado. Por
            se tratarem de melhorias voluntárias, a ausência de comunicação
            prévia não configura violação destes Termos.
          </p>

          <h2 className="mt-6 mb-3 text-xl font-bold">
            Comunicações e Marketing
          </h2>
          <p className="mb-4">
            <span className="font-semibold">
              Concordância com o Recebimento:
            </span>{' '}
            Ao aceitar estes Termos de Uso, o Usuário autoriza a OrtoQBank a
            enviar comunicações de caráter informativo, promocional e de
            marketing referentes ao OrtoQBank ou a produtos e serviços
            relacionados. Essas comunicações poderão ocorrer por e-mail, SMS,
            aplicações de mensagem instantânea ou outros meios de contato
            fornecidos pelo Usuário no cadastro.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Opção de Descadastramento:</span> O
            Usuário poderá, a qualquer tempo, optar por não mais receber
            comunicações de marketing. Para isso, a OrtoQBank disponibiliza
            mecanismos de descadastro (por exemplo, link de &ldquo;cancelar
            subscrição&rdquo; em e-mails promocionais) ou o Usuário poderá
            entrar em contato com o suporte solicitando o cancelamento do envio
            de mensagens promocionais. Após a solicitação, a OrtoQBank
            empreenderá seus melhores esforços para cessar o envio das
            comunicações indesejadas no menor prazo possível.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Proteção de Dados:</span> As
            informações de contato do Usuário serão utilizadas de acordo com a
            Política de Privacidade da OrtoQBank e em conformidade com a
            legislação aplicável de proteção de dados, incluindo a Lei Geral de
            Proteção de Dados (LGPD - Lei Federal nº 13.709/2018). A OrtoQBank
            se compromete a não fornecer dados pessoais do Usuário a terceiros
            para fins de marketing sem o devido consentimento, limitando-se a
            utilizar os dados para comunicações diretas da própria plataforma.
          </p>

          <h2 className="mt-6 mb-3 text-xl font-bold">Disposições Gerais</h2>
          <p className="mb-4">
            <span className="font-semibold">Alterações dos Termos:</span> A
            OrtoQBank reserva-se o direito de alterar ou atualizar estes Termos
            de Uso a qualquer momento, mediante publicação da versão revisada na
            plataforma ou envio de comunicação ao e-mail cadastrado do Usuário.
            Recomenda-se que o Usuário verifique periodicamente a versão mais
            atualizada dos Termos. A continuação do uso do OrtoQBank após
            alterações nos Termos representa a concordância tácita do Usuário
            com as modificações realizadas.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Cessão e Transferência:</span> O
            Usuário não pode ceder, transferir ou onerar de qualquer forma seus
            direitos ou obrigações decorrentes destes Termos de Uso sem prévia
            autorização por escrito da OrtoQBank. A OrtoQBank poderá ceder ou
            transferir a plataforma, bem como seus direitos e deveres relativos
            a este Termo, a qualquer tempo, a seu exclusivo critério, mediante
            simples comunicação ao Usuário, desde que mantidas as condições aqui
            contratadas.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Integralidade do Acordo:</span>{' '}
            Estes Termos de Uso, juntamente com a Política de Privacidade do
            OrtoQBank (se aplicável) e demais regras ou termos específicos
            disponibilizados na plataforma, constituem o acordo integral entre a
            OrtoQBank e o Usuário no que diz respeito à utilização do serviço.
            Na hipótese de qualquer disposição destes Termos ser considerada
            ilegal, inválida ou inexequível, as demais disposições permanecerão
            em pleno vigor e efeito.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Renúncia e Tolerância:</span> A
            eventual tolerância da OrtoQBank quanto ao descumprimento de
            quaisquer condições destes Termos, ou a não exercício de qualquer
            direito que lhe seja assegurado, não constituirá renúncia, novação
            ou modificação das disposições presentes, podendo a OrtoQBank
            exercê-los plenamente a qualquer tempo.
          </p>
          <p className="mb-4">
            <span className="font-semibold">Legislação e Foro:</span> Estes
            Termos de Uso serão regidos e interpretados de acordo com as leis da
            República Federativa do Brasil. Quaisquer litígios ou controvérsias
            decorrentes da utilização do OrtoQBank ou relacionados a estes
            Termos serão preferencialmente resolvidos de forma amigável. Não
            havendo solução consensual, fica desde já eleito o foro da comarca
            da sede da OrtoQBank, no Brasil, como o competente para dirimir os
            conflitos oriundos deste instrumento, com renúncia expressa a
            qualquer outro, por mais privilegiado que seja ou venha a ser.
          </p>

          <p className="mt-8 mb-2 text-sm text-gray-500">
            Última atualização destes Termos de Uso: Abril de 2025.
          </p>
        </div>

        <div className="text-muted-foreground mt-1 mb-2 px-2 text-xs">
          Role para baixo para ler todos os termos.
        </div>

        <DialogFooter className="mt-2">
          <Button
            onClick={onAccept}
            className="w-full sm:w-auto"
            disabled={isLoading}
          >
            {isLoading ? 'Processando...' : 'Aceito os Termos de Serviço'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
