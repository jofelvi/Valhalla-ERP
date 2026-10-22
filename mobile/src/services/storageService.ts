import { Platform } from 'react-native';
import { API_URL } from '../config/env';
import { APP_VERSION } from '../config/appVersion';
import { getAccessToken } from './api/apiClient';
import { logClientEvent } from './clientLogService';

const CLIENT_PLATFORM = Platform.OS;

// Tope absoluto de seguridad (anti-zombie, no tiene UX)
const ABS_TIMEOUT_MS = 300_000;

async function readFileAsBase64(uri: string): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('No se pudo leer la imagen local'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Lectura base64 fallida'));
        return;
      }
      const idx = result.indexOf('base64,');
      resolve(idx >= 0 ? result.slice(idx + 'base64,'.length) : result);
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

export interface UploadOptions {
  /** Callback con porcentaje 0-100 mientras suben los bytes. */
  onProgress?: (pct: number) => void;
  /** Permite al consumidor cancelar el upload (boton "Cancelar"). */
  signal?: AbortSignal;
}

/**
 * Sube un comprobante via XHR (no fetch) para tener progress real del upload.
 * Doble timeout: idle (sin progress por 30s) y absoluto (5 min).
 */
export const uploadPaymentProof = async (
  localUri: string,
  orderId: string,
  index: number,
  opts?: UploadOptions,
): Promise<string> => {
  const start = Date.now();
  let base64Length = 0;
  try {
    const base64 = await readFileAsBase64(localUri);
    base64Length = base64.length;
    const extRaw = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const extension = (
      ['jpg', 'jpeg', 'png', 'webp'].includes(extRaw) ? extRaw : 'jpg'
    ) as 'jpg' | 'jpeg' | 'png' | 'webp';

    const body = JSON.stringify({
      category: 'payment-proofs',
      subPath: orderId,
      imageBase64: base64,
      extension,
    });

    const token = await getAccessToken();

    const url = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let absTimer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      const cleanup = () => {
        if (absTimer) {
          clearTimeout(absTimer);
          absTimer = null;
        }
      };

      const fail = (reason: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          xhr.abort();
        } catch {
          // ignore
        }
        reject(new Error(reason));
      };

      const ok = (value: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      absTimer = setTimeout(
        () => fail(`Upload excedio ${ABS_TIMEOUT_MS / 1000}s totales`),
        ABS_TIMEOUT_MS,
      );

      xhr.open('POST', `${API_URL}/api/uploads/image`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-Client-Type', 'apk');
      xhr.setRequestHeader('X-Client-Platform', CLIENT_PLATFORM);
      xhr.setRequestHeader('X-App-Version', APP_VERSION);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        const pct = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
        opts?.onProgress?.(pct);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const parsed = JSON.parse(xhr.responseText) as { url?: string };
            if (parsed?.url) {
              opts?.onProgress?.(100);
              ok(parsed.url);
            } else {
              fail('Respuesta del servidor sin campo url');
            }
          } catch {
            fail('JSON invalido en respuesta del servidor');
          }
        } else {
          fail(`HTTP ${xhr.status}: ${(xhr.responseText || '').slice(0, 200)}`);
        }
      };

      xhr.onerror = () => fail('Error de red durante el upload');
      xhr.ontimeout = () => fail('Timeout del XHR');

      if (opts?.signal) {
        if (opts.signal.aborted) {
          fail('Upload cancelado por el usuario');
          return;
        }
        opts.signal.addEventListener('abort', () =>
          fail('Upload cancelado por el usuario'),
        );
      }

      xhr.send(body);
    });

    const dur = Date.now() - start;
    void logClientEvent({
      level: 'info',
      source: 'storageService.uploadPaymentProof',
      message: `Upload OK in ${dur}ms (${Math.round(base64Length / 1024)}KB)`,
      context: {
        orderId,
        index,
        durationMs: dur,
        approxBase64KB: Math.round(base64Length / 1024),
      },
    });
    return url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const dur = Date.now() - start;
    void logClientEvent({
      level: 'error',
      source: 'storageService.uploadPaymentProof',
      message: `Upload failed: ${msg}`,
      context: {
        orderId,
        index,
        uri: localUri,
        durationMs: dur,
        approxBase64KB: Math.round(base64Length / 1024),
      },
    });
    throw err;
  }
};

export const uploadPaymentProofs = async (
  localUris: string[],
  orderId: string,
  opts?: {
    onProgress?: (index: number, pct: number) => void;
    signal?: AbortSignal;
  },
): Promise<string[]> => {
  const uploads = localUris.map((uri, i) =>
    uploadPaymentProof(uri, orderId, i, {
      onProgress: (pct) => opts?.onProgress?.(i, pct),
      signal: opts?.signal,
    }),
  );
  return Promise.all(uploads);
};
