import { redirect } from 'next/navigation';

/** "General" fue reemplazado por Negocio, Marca, Tarifas, Nómina y Operación. */
export default function GeneralSettingsPage() {
  redirect('/private/settings/negocio');
}
