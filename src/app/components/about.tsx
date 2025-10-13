import {
  BarChart3,
  BookOpen,
  CheckCircle,
  ClipboardList,
  FileText,
  Lightbulb,
  Smartphone,
} from 'lucide-react';

export default function About() {
  return (
    <section id="sobre" className="bg-blue-50 py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-[#2196F3] md:text-4xl lg:text-5xl">
            Sobre o OrtoQBank
          </h2>
          <div className="mx-auto mb-6 h-1 w-20 rounded-full bg-[#2196F3]"></div>
          
      
          <p className="text-lg leading-relaxed text-gray-700">
            <span className="mb-3 block text-xl font-bold text-[#2196F3]">
              NOSSA METODOLOGIA
            </span>
            Criamos um método validado nas provas mais concorridas do universo
            médico e baseado na resolução de questões. Esqueça as apostilas e
            livros intermináveis. Com esse método, você vai otimizar o seu tempo
            de estudo sendo direcionado para tudo aquilo que realmente importa!
            Você vai treinar para fazer exatamente o que fará no dia da prova:
          </p>
        </div>

            {/* Video Section */}
            <div className="mx-auto mb-8 aspect-video max-w-2xl overflow-hidden rounded-lg shadow-lg">
            <iframe 
              width="100%" 
              height="100%" 
              src="https://imagekit.io/player/embed/4hmtj9yu8/VID-20251008-WA0049-min.mp4?controls=true&autoplay=false&loop=false&background=%23000000&updatedAt=1759967892697&thumbnail=https%3A%2F%2Fik.imagekit.io%2F4hmtj9yu8%2FVID-20251008-WA0049-min.mp4%2Fik-thumbnail.jpg%3FupdatedAt%3D1759967892697&updatedAt=1759967892697" 
              title="ImageKit video player" 
              sandbox="allow-scripts allow-same-origin"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              loading="lazy"
              style={{ border: 0 }}
              className="h-full w-full"
            />
          </div>


        <div className="space-y-6">
          {/* First row - 3 cards */}
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-lg transition-shadow duration-300 hover:shadow-xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#2196F3]">
                <FileText className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-center text-xl font-bold">
                Banco de Questões Completo
              </h3>
              <p className="text-center text-gray-600">
                Um banco de questões completo com gabaritos direcionados por
                especialistas da USP, baseados na bibliografia da SBOT mas com os
                insights diferenciais dos professores.
              </p>
            </div>

            <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-lg transition-shadow duration-300 hover:shadow-xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#2196F3]">
                <Smartphone className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-center text-xl font-bold">
                Plataforma Responsiva
              </h3>
              <p className="text-center text-gray-600">
                Plataforma responsiva para computador, tablet e celular,
                permitindo que você estude em qualquer lugar e a qualquer momento.
              </p>
            </div>

            <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-lg transition-shadow duration-300 hover:shadow-xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#2196F3]">
                <Lightbulb className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-center text-xl font-bold">
                Desempenho Garantido
              </h3>
              <p className="text-center text-gray-600">
                Aprenda enquanto faz questões e alcance o desempenho de 80% na
                prova do TEOT e TEPOT!
              </p>
            </div>
          </div>

          {/* Second row - 2 cards centered */}
          <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-lg transition-shadow duration-300 hover:shadow-xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#2196F3]">
                <BarChart3 className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-center text-xl font-bold">
                Análise de Desempenho
              </h3>
              <p className="text-center text-gray-600">
                Acompanhe seu progresso com estatísticas detalhadas e identifique
                áreas que precisam de mais atenção para maximizar seu aprendizado.
              </p>
            </div>

            <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-lg transition-shadow duration-300 hover:shadow-xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#2196F3]">
                <BookOpen className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-center text-xl font-bold">
                Conteúdo Atualizado
              </h3>
              <p className="text-center text-gray-600">
                Material constantemente atualizado de acordo com as referências
                bibliográficas da SBOT e com as novas provas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
