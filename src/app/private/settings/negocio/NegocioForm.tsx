'use client';

import { PantallaSeccion } from '../components/PantallaSeccion';
import {
  CampoArea,
  CampoCasilla,
  CampoTexto,
  Grupo,
} from '../components/Campos';
import { useFormularioConfig } from '../hooks/useFormularioConfig';
import { aFormulario, aValor, negocioEsquema } from './negocioFormulario';

export function NegocioForm() {
  const vista = useFormularioConfig({
    id: 'negocio',
    nombre: 'Negocio',
    esquema: negocioEsquema,
    aFormulario,
    aValor,
  });
  const { register, watch, formState } = vista.form;
  const { errors } = formState;
  const conPagoMovil = watch('pagoMovilActivo');
  const conTransferencia = watch('transferenciaActiva');

  return (
    <PantallaSeccion
      titulo="Negocio"
      descripcion="Estos datos salen en recibos, facturas y mensajes a los clientes. Déjelos completos antes de vender."
      vista={vista}
    >
      <Grupo titulo="Identidad y contacto">
        <CampoTexto
          id="tradeName"
          etiqueta="Nombre comercial"
          registro={register('tradeName')}
          error={errors.tradeName}
          ayuda="Es el nombre que ven los clientes. Sin este dato la instalación figura como sin configurar."
          required
          autoComplete="organization"
        />
        <CampoTexto
          id="tagline"
          etiqueta="Subtítulo"
          registro={register('tagline')}
          error={errors.tagline}
          ayuda="Va bajo el nombre en el ticket (ej. Restaurante y bar)."
        />
        <CampoTexto
          id="legalName"
          etiqueta="Razón social"
          registro={register('legalName')}
          error={errors.legalName}
          ayuda="Nombre legal para facturas fiscales."
        />
        <CampoTexto
          id="taxId"
          etiqueta="RIF o identificación fiscal"
          registro={register('taxId')}
          error={errors.taxId}
        />
        <CampoTexto
          id="address"
          etiqueta="Domicilio"
          registro={register('address')}
          error={errors.address}
          autoComplete="street-address"
        />
        <CampoTexto
          id="phone"
          etiqueta="Teléfono"
          registro={register('phone')}
          error={errors.phone}
          type="tel"
          autoComplete="tel"
        />
        <CampoTexto
          id="email"
          etiqueta="Correo del negocio"
          registro={register('email')}
          error={errors.email}
          type="email"
          autoComplete="email"
        />
        <CampoTexto
          id="website"
          etiqueta="Sitio web"
          registro={register('website')}
          error={errors.website}
          type="url"
          placeholder="https://"
        />
        <CampoTexto
          id="instagram"
          etiqueta="Instagram"
          registro={register('instagram')}
          error={errors.instagram}
          ayuda="Sin arroba, ej. minegocio."
        />
      </Grupo>

      <Grupo titulo="Textos de recibos y alertas">
        <CampoTexto
          id="receiptFooter"
          etiqueta="Mensaje al pie del ticket"
          registro={register('receiptFooter')}
          error={errors.receiptFooter}
          ayuda="Agradecimiento que sale al final del ticket."
        />
        <CampoArea
          id="legalText"
          etiqueta="Texto legal"
          registro={register('legalText')}
          error={errors.legalText}
          ayuda="Aparece al pie de las facturas. Puede dejarlo vacío."
        />
        <CampoTexto
          id="alertsEmail"
          etiqueta="Correo para alertas"
          registro={register('alertsEmail')}
          error={errors.alertsEmail}
          type="email"
          ayuda="Aquí llegan avisos como una impresora desconectada o los informes semanales."
        />
      </Grupo>

      <Grupo
        titulo="Pago Móvil"
        descripcion="Opcional. Si lo activa, el cliente verá estos datos para pagar."
      >
        <CampoCasilla
          id="pagoMovilActivo"
          etiqueta="Acepto Pago Móvil"
          registro={register('pagoMovilActivo')}
          interruptor
        />
        {conPagoMovil && (
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id="pmBank"
              etiqueta="Código del banco"
              registro={register('pmBank')}
              error={errors.pmBank}
              inputMode="numeric"
              ayuda="4 cifras, ej. 0102."
            />
            <CampoTexto
              id="pmPhone"
              etiqueta="Teléfono de Pago Móvil"
              registro={register('pmPhone')}
              error={errors.pmPhone}
              type="tel"
            />
            <CampoTexto
              id="pmDocumentId"
              etiqueta="Cédula o RIF del titular"
              registro={register('pmDocumentId')}
              error={errors.pmDocumentId}
            />
          </div>
        )}
      </Grupo>

      <Grupo
        titulo="Transferencia bancaria"
        descripcion="Opcional. Sirve para que el cliente pague por transferencia."
      >
        <CampoCasilla
          id="transferenciaActiva"
          etiqueta="Acepto transferencias"
          registro={register('transferenciaActiva')}
          interruptor
        />
        {conTransferencia && (
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id="btBank"
              etiqueta="Banco"
              registro={register('btBank')}
              error={errors.btBank}
            />
            <CampoTexto
              id="btAccount"
              etiqueta="Número de cuenta"
              registro={register('btAccount')}
              error={errors.btAccount}
              inputMode="numeric"
            />
            <CampoTexto
              id="btHolder"
              etiqueta="Titular de la cuenta"
              registro={register('btHolder')}
              error={errors.btHolder}
            />
            <CampoTexto
              id="btDocumentId"
              etiqueta="Cédula o RIF del titular"
              registro={register('btDocumentId')}
              error={errors.btDocumentId}
            />
          </div>
        )}
      </Grupo>
    </PantallaSeccion>
  );
}
