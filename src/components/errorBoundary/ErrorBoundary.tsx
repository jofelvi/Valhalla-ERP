'use client';

import React from 'react';

interface State {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  isChunkError: boolean;
}

interface Props {
  children: React.ReactNode;
}

// Tras un deploy, los chunks JS cambian de hash. Una pestaña vieja que intenta
// cargar un chunk del build anterior recibe "ChunkLoadError" / "Failed to load
// chunk". No es un bug: solo hay que recargar para traer el build actual.
const CHUNK_RELOAD_KEY = 'chunk-reload-attempted';
function isChunkLoadError(error: Error): boolean {
  const name = error?.name ?? '';
  const msg = error?.message ?? '';
  return (
    name === 'ChunkLoadError' ||
    /loading chunk [\d]+ failed/i.test(msg) ||
    /failed to load chunk/i.test(msg)
  );
}

// Boundary global que captura errores de render y muestra el stack trace real
// en pantalla. Evita la pantalla negra genérica "Application error" y nos deja
// ver qué paso exactamente sin necesidad de abrir devtools.
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, errorInfo: null, isChunkError: false };
  }

  componentDidMount() {
    // Render exitoso = estamos en un build válido. Limpiar el guard para que
    // un futuro deploy pueda volver a auto-recargar una vez.
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Capturado:', error, errorInfo);

    if (isChunkLoadError(error) && typeof window !== 'undefined') {
      // Deploy nuevo: forzar UNA recarga para traer los chunks actuales.
      // Guard con sessionStorage para no entrar en loop si no resuelve.
      if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        return;
      }
    }

    this.setState({ error, errorInfo });
  }

  reset = () => {
    this.setState({ error: null, errorInfo: null, isChunkError: false });
  };

  reload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      // Chunk error: estamos recargando para traer el build nuevo (o ya se
      // intentó). Mostrar mensaje amable en vez del stack técnico.
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen bg-page flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-surface border border-line rounded-xl p-6 shadow-lg text-center">
              <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-brand text-2xl">↻</span>
              </div>
              <h1 className="text-lg font-bold text-content mb-1">
                Actualizando a la última versión
              </h1>
              <p className="text-sm text-dim mb-4">
                Se publicó una nueva versión del sistema. Estamos recargando
                para traértela.
              </p>
              <button
                onClick={this.reload}
                className="px-4 py-2 bg-brand text-on-brand text-sm font-semibold rounded-lg hover:bg-brand/90 transition-colors"
              >
                Recargar ahora
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-page flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-surface border border-danger/30 rounded-xl p-6 shadow-lg">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-danger/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-danger text-xl">⚠</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-content">
                  Algo se rompio
                </h1>
                <p className="text-sm text-dim mt-0.5">
                  Ocurrio un error en el cliente. Abajo esta el detalle para el
                  equipo tecnico.
                </p>
              </div>
            </div>

            <div className="bg-page border border-line rounded-lg p-3 mb-3 overflow-auto max-h-64">
              <div className="text-xs font-mono text-danger font-semibold mb-2">
                {this.state.error.name}: {this.state.error.message}
              </div>
              {this.state.error.stack && (
                <pre className="text-[11px] font-mono text-dim whitespace-pre-wrap break-all leading-relaxed">
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            {this.state.errorInfo?.componentStack && (
              <details className="mb-3">
                <summary className="text-xs text-dim cursor-pointer select-none">
                  Component stack (click para expandir)
                </summary>
                <pre className="mt-2 text-[11px] font-mono text-dim whitespace-pre-wrap break-all bg-page border border-line rounded-lg p-3 max-h-48 overflow-auto">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <button
                onClick={this.reload}
                className="px-4 py-2 bg-brand text-on-brand text-sm font-semibold rounded-lg hover:bg-brand/90 transition-colors"
              >
                Recargar pagina
              </button>
              <button
                onClick={this.reset}
                className="px-4 py-2 bg-elevated border border-line text-content text-sm font-medium rounded-lg hover:bg-surface transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
