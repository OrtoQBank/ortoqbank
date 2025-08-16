'use client';

import Link from 'next/link';
import { useState } from 'react';

export function HoverPrefetchLink({
  href,
  children,
  className,
  ...props
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) {
  const [active, setActive] = useState(false);

  return (
    <Link
      href={href}
      prefetch={active ? null : false}
      onMouseEnter={() => setActive(true)}
      className={className}
      {...props}
    >
      {children}
    </Link>
  );
}
