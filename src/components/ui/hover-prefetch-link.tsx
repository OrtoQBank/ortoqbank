'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useState } from 'react';

// Exclude prefetch from props to prevent external overrides
type LinkProps = Omit<ComponentProps<typeof Link>, 'prefetch' | 'href'>;

interface HoverPrefetchLinkProps extends LinkProps {
  href: string;
  children: React.ReactNode;
}

export function HoverPrefetchLink({
  href,
  children,
  onMouseEnter,
  onFocus,
  onPointerEnter,
  ...props
}: HoverPrefetchLinkProps) {
  const [active, setActive] = useState(false);

  const handleActivation = () => {
    setActive(true);
  };

  const handleMouseEnter = (event: React.MouseEvent<HTMLAnchorElement>) => {
    handleActivation();
    onMouseEnter?.(event);
  };

  const handleFocus = (event: React.FocusEvent<HTMLAnchorElement>) => {
    handleActivation();
    onFocus?.(event);
  };

  const handlePointerEnter = (event: React.PointerEvent<HTMLAnchorElement>) => {
    handleActivation();
    onPointerEnter?.(event);
  };

  return (
    <Link
      href={href}
      prefetch={active}
      {...props}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      onPointerEnter={handlePointerEnter}
    >
      {children}
    </Link>
  );
}
