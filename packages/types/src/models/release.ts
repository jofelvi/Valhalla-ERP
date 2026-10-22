import { ReleaseAmbito } from '../enums/release';

/** El commit que quedo desplegado en cada lado. Sin esto no hay a donde volver. */
export interface ShasDespliegue {
  web?: string;
  api?: string;
}

/** Una entrada de la bitacora: un despliegue y lo que traia. */
export interface Release {
  id: string;
  fecha: string;
  ambito: ReleaseAmbito[];
  version?: string;
  titulo: string;
  cambios: string[];
  commits?: string[];
  shas: ShasDespliegue;
  /** Si el despliegue movio datos. Gobierna la reversion. */
  migroDatos: boolean;
  /** Id de la entrada de la que nacio, si esta entrada es fruto de un rollback. */
  revertidaDe?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
