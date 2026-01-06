import Image from 'next/image';

interface StaffMember {
  name: string;
  description: string[];
  imageUrl: string;
}

const staffMembers: StaffMember[] = [
  {
    name: 'Daniel Duarte Perini',
    description: [
      'Médico graduado pela Faculdade de Medicina da USP (FMUSP)',
      'Ortopedista pelo Instituto de Ortopedia e Traumatologia do HC-FMUSP (IOT)',
      'Fellowship Cirurgia da Coluna Vertebral (IOT)',
    ],
    imageUrl: '/medico1.jpg',
  },
  {
    name: 'Vitor Ricardo Moraes',
    description: [
      'Médico graduado pela Faculdade de Medicina de Ribeirão Preto da USP (FMRP-USP)',
      'Ortopedista pelo Instituto de Ortopedia e Traumatologia do HC-FMUSP (IOT)',
      'Fellowship Cirurgia do Joelho (IOT)',
    ],
    imageUrl: '/medico2.jpg',
  },
];

export default function StaffSection() {
  return (
    <section className="bg-white py-12 md:py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-brand-blue mb-8 text-center text-3xl font-bold md:text-4xl">
          Nossa Equipe
        </h2>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          {staffMembers.map((member, index) => (
            <div
              key={index}
              className="border-brand-blue/20 mx-auto w-full max-w-[330px] overflow-hidden rounded-lg border bg-white shadow-lg"
            >
              <div className="overflow-hidden">
                <Image
                  src={member.imageUrl || '/placeholder.svg'}
                  alt={`Foto de ${member.name}`}
                  width={330}
                  height={330}
                  priority={index === 0}
                  className="rounded-t-lg object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="text-brand-blue mb-1 text-xl font-semibold">
                  {member.name}
                </h3>

                <ul className="list-disc space-y-1 pl-4 text-sm text-gray-600">
                  {member.description.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
