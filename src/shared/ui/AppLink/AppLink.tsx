'use client';

import NextLink, { type LinkProps } from 'next/link';
import { forwardRef, type AnchorHTMLAttributes } from 'react';

type AppLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children?: React.ReactNode;
  };

const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(
  { prefetch = false, ...rest },
  ref,
) {
  return <NextLink ref={ref} prefetch={prefetch} {...rest} />;
});

export default AppLink;
