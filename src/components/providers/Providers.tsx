'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { ToastContainer } from 'react-toastify';
import { QueryProvider } from '@/providers/QueryProvider';
import { OfflineAlert } from '@/components/shared/OfflineAlert';
import VersionBanner from '@/components/versionBanner/VersionBanner';
import ErrorBoundary from '@/components/errorBoundary/ErrorBoundary';
import { SwRegisterer } from '@/components/providers/SwRegisterer';
import type { ConfigPublica } from '@odin6/types';
import 'react-toastify/dist/ReactToastify.css';

export function Providers({
  children,
  configInicial,
}: {
  children: React.ReactNode;
  configInicial: ConfigPublica;
}) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme={configInicial.marca.defaultTheme}
      disableTransitionOnChange
    >
      <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
        <QueryProvider configInicial={configInicial}>
          <ErrorBoundary>
            {children}
            <VersionBanner />
            <OfflineAlert />
            <SwRegisterer />
          </ErrorBoundary>
        </QueryProvider>
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          style={{ zIndex: 9999 }}
        />
      </SessionProvider>
    </ThemeProvider>
  );
}
