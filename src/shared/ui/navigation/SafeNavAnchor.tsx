'use client';

import { forwardRef, type AnchorHTMLAttributes } from 'react';
import Link from 'next/link';

type SafeNavAnchorProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> & {
  href: string;
  debugLabel?: string;
};

const isInternalPath = (href: string) => href.startsWith('/');

export const SafeNavAnchor = forwardRef<HTMLAnchorElement, SafeNavAnchorProps>(
  function SafeNavAnchor(
    { href, onClick, target, rel, debugLabel: _debugLabel, ...props },
    ref,
  ) {
    // Si viene target="_blank" o externo, lo arrojamos como <a> normal
    if (target && target !== '_self') {
      return (
        <a
          ref={ref}
          href={href}
          onClick={onClick}
          rel={target === '_blank' ? (rel ?? 'noopener noreferrer') : rel}
          target={target}
          {...props}
        />
      );
    }

    if (!isInternalPath(href)) {
      return <a ref={ref} href={href} onClick={onClick} rel={rel} {...props} />;
    }

    // Para rutas internas SPA en App Router, usamos <Link> oficial de next para prevenir locks
    // Sin prefetch: el menu disparaba ~44 prefetch RSC al cargar. En App Router
    // false los apaga del todo (tampoco al pasar el mouse); cada segmento tiene su
    // loading, asi que el clic muestra el esqueleto al instante.
    return (
      <Link
        ref={ref}
        href={href}
        onClick={onClick}
        prefetch={false}
        {...props}
      />
    );
  },
);
