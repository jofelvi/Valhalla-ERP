import { OPERACION_DEFAULT } from '@odin6/types';
import { SmsService, SMS_SEGMENT_CHARS } from './sms.service';
import { buildCreditSms, buildPurchaseSms } from './sms-messages';

describe('SmsService.toE164', () => {
  it('convierte el formato venezolano tipico', () => {
    expect(SmsService.toE164('04140000006', OPERACION_DEFAULT)).toBe(
      '+584140000006',
    );
    expect(SmsService.toE164('0414-0000006', OPERACION_DEFAULT)).toBe(
      '+584140000006',
    );
    expect(SmsService.toE164('0414 000 0006', OPERACION_DEFAULT)).toBe(
      '+584140000006',
    );
  });

  it('acepta el numero sin el cero inicial', () => {
    expect(SmsService.toE164('4140000005', OPERACION_DEFAULT)).toBe(
      '+584140000005',
    );
  });

  it('acepta el numero que ya trae codigo de pais', () => {
    expect(SmsService.toE164('584140000005', OPERACION_DEFAULT)).toBe(
      '+584140000005',
    );
    expect(SmsService.toE164('+58 414 0000005', OPERACION_DEFAULT)).toBe(
      '+584140000005',
    );
  });

  // Preferimos no enviar antes que enviar a un numero adivinado: un SMS a un
  // tercero expone el consumo de un cliente.
  it('devuelve null en lo que no se puede reconocer', () => {
    expect(SmsService.toE164('', OPERACION_DEFAULT)).toBeNull();
    expect(SmsService.toE164(null, OPERACION_DEFAULT)).toBeNull();
    expect(SmsService.toE164(undefined, OPERACION_DEFAULT)).toBeNull();
    expect(SmsService.toE164('1234', OPERACION_DEFAULT)).toBeNull();
    expect(SmsService.toE164('sin telefono', OPERACION_DEFAULT)).toBeNull();
    expect(SmsService.toE164('0212-5551234', OPERACION_DEFAULT)).toBeNull(); // fijo, no recibe SMS
  });
});

describe('armado de mensajes', () => {
  const publicAppUrl = 'https://app.ejemplo.com';

  it('el aviso de compra lleva codigo, total y enlace al detalle', () => {
    const body = buildPurchaseSms({
      customerName: 'MARIA ANGELICA FONSECA REBOLLEDO',
      orderId: '6a5adaf85f23a90e4336efe8',
      total: 206.25,
      itemCount: 7,
      publicAppUrl,
    });
    expect(body).toContain('4336EFE8');
    expect(body).toContain('$206.25');
    expect(body).toContain('7 item(s)');
    // Solo el primer nombre: el padron del club trae nombres larguisimos y
    // cada 160 caracteres es un SMS mas que se paga.
    expect(body).toContain('MARIA, gracias');
    expect(body).not.toContain('REBOLLEDO');
    expect(body).toContain(
      `${publicAppUrl}/public/precuenta/6a5adaf85f23a90e4336efe8`,
    );
  });

  it('el aviso de credito enlaza a reportar pago y muestra vencimiento', () => {
    const body = buildCreditSms({
      customerName: 'Eliecer Villegas',
      orderId: '6a2c7fb45bae574ca3db345e',
      accountReceivableId: 'acc-123',
      amount: 86.31,
      dueDate: new Date('2026-08-28T12:00:00Z'),
      publicAppUrl,
    });
    expect(body).toContain('Eliecer, tu consumo');
    expect(body).toContain('#A3DB345E');
    expect(body).toContain('$86.31');
    expect(body).toContain('Vence 28/08');
    expect(body).toContain(`${publicAppUrl}/public/reportar-pago/acc-123`);
  });

  it('funciona sin nombre y sin orden asociada', () => {
    const body = buildCreditSms({
      customerName: null,
      orderId: null,
      accountReceivableId: 'acc-9',
      amount: 10,
      publicAppUrl,
    });
    expect(body).toContain('Tu consumo quedo pendiente');
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('#');
  });

  // Cada 160 caracteres la operadora cobra otro mensaje, asi que los avisos
  // tienen que entrar en 2 segmentos incluso con nombres y montos largos.
  it('los avisos no se pasan de 2 segmentos', () => {
    const compra = buildPurchaseSms({
      customerName: 'ROSALES LABRADOR ANGELICA DEL CARMEN',
      orderId: '6a5adaf85f23a90e4336efe8',
      total: 1937.44,
      itemCount: 43,
      publicAppUrl,
    });
    const credito = buildCreditSms({
      customerName: 'ROSALES LABRADOR ANGELICA DEL CARMEN',
      orderId: '6a5adaf85f23a90e4336efe8',
      accountReceivableId: '6a63921f55955757e58e4b76',
      amount: 1937.44,
      dueDate: new Date('2026-08-28T12:00:00Z'),
      publicAppUrl,
    });
    expect(SmsService.countSegments(compra)).toBeLessThanOrEqual(2);
    expect(SmsService.countSegments(credito)).toBeLessThanOrEqual(2);
    expect(SMS_SEGMENT_CHARS).toBe(160);
  });
});
