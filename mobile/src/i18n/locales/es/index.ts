import shared from './shared';
import auth from './auth';

export const es = { shared, auth } as const;
export type EsResources = typeof es;
