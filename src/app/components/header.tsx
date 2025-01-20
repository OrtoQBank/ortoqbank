import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-[#2196F3] text-white">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/logo.webp"
            alt="OrtoQBank Logo"
            width={40}
            height={40}
            className="rounded-sm"
          />
          <span className="text-2xl font-bold">OrtoQBank</span>
        </Link>
        <nav>
          <ul className="flex space-x-4">
            <li>
              <Link
                href="#sobre"
                className="text-base transition-opacity hover:opacity-80"
              >
                Sobre
              </Link>
            </li>
            <li>
              <Link href="#precos" className="hover:text-opacity-80">
                Preços
              </Link>
            </li>
            <li>
              <Link href="#faq" className="hover:text-opacity-80">
                FAQ
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
