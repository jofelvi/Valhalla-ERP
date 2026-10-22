import {
  classifyOrderPaymentStatus,
  buildPaymentStatusError,
  PaymentStatusClassification,
} from './credit-approval.util';

describe('credit-approval.util', () => {
  describe('classifyOrderPaymentStatus', () => {
    it('debe clasificar como PAID cuando paymentStatus es "PAID"', () => {
      const order = {
        total: 100,
        paidAmount: 100,
        paymentStatus: 'PAID',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('PAID');
      expect(result.paidAmount).toBe(100);
      expect(result.total).toBe(100);
    });

    it('debe clasificar como PAID cuando paymentStatus es "paid" (minúsculas)', () => {
      const order = {
        total: 100,
        paidAmount: 100,
        paymentStatus: 'paid',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('PAID');
    });

    it('debe clasificar como PAID cuando paymentStatus es "Paid" (mayúsculas mixtas)', () => {
      const order = {
        total: 100,
        paidAmount: 100,
        paymentStatus: 'Paid',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('PAID');
    });

    it('debe clasificar como PAID cuando paidAmount >= total - 0.01', () => {
      const order = {
        total: 100,
        paidAmount: 100,
        paymentStatus: 'pending',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('PAID');
    });

    it('debe clasificar como PAID cuando paidAmount === total (redondeo cerca)', () => {
      const order = {
        total: 100.005, // Será ~100 con redondeo
        paidAmount: 100,
        paymentStatus: 'pending',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('PAID');
    });

    it('debe clasificar como PAID cuando paidAmount es 0.01 menos que total', () => {
      const order = {
        total: 100,
        paidAmount: 99.99,
        paymentStatus: 'pending',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('PAID');
    });

    it('debe clasificar como PAID sin paidAmount pero con paymentStatus=PAID (orden vieja)', () => {
      const order = {
        total: 100,
        paidAmount: undefined,
        paymentStatus: 'PAID',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('PAID');
      expect(result.paidAmount).toBe(0);
    });

    it('debe clasificar como PARTIALLY_PAID cuando 0 < paidAmount < total', () => {
      const order = {
        total: 100,
        paidAmount: 50,
        paymentStatus: 'pending',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('PARTIALLY_PAID');
    });

    it('debe clasificar como PARTIALLY_PAID cuando paidAmount es muy pequeño', () => {
      const order = {
        total: 100,
        paidAmount: 0.5,
        paymentStatus: 'pending',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('PARTIALLY_PAID');
    });

    it('debe clasificar como UNPAID cuando paidAmount === 0', () => {
      const order = {
        total: 100,
        paidAmount: 0,
        paymentStatus: 'pending',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('UNPAID');
    });

    it('debe clasificar como UNPAID cuando paidAmount es undefined', () => {
      const order = {
        total: 100,
        paidAmount: undefined,
        paymentStatus: 'pending',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('UNPAID');
    });

    it('debe clasificar como UNPAID cuando no hay paymentStatus ni paidAmount', () => {
      const order = {
        total: 100,
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('UNPAID');
    });

    it('debe clasificar como ZERO_OR_NEGATIVE_TOTAL cuando total === 0', () => {
      const order = {
        total: 0,
        paidAmount: 0,
        paymentStatus: 'pending',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('ZERO_OR_NEGATIVE_TOTAL');
    });

    it('debe clasificar como ZERO_OR_NEGATIVE_TOTAL cuando total < 0', () => {
      const order = {
        total: -10,
        paidAmount: 0,
        paymentStatus: 'pending',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('ZERO_OR_NEGATIVE_TOTAL');
    });

    it('debe clasificar como ZERO_OR_NEGATIVE_TOTAL cuando total es undefined (0)', () => {
      const order = {
        total: undefined,
        paidAmount: 0,
        paymentStatus: 'pending',
      };

      const result = classifyOrderPaymentStatus(order);

      expect(result.status).toBe('ZERO_OR_NEGATIVE_TOTAL');
    });
  });

  describe('buildPaymentStatusError', () => {
    it('debe generar mensaje para PAID', () => {
      const classification: PaymentStatusClassification = {
        status: 'PAID',
        paidAmount: 100,
        total: 100,
      };

      const message = buildPaymentStatusError(classification);

      expect(message).toContain('ya está cobrada');
      expect(message).toContain('cierra la solicitud');
    });

    it('debe generar mensaje para PARTIALLY_PAID con montos correctos', () => {
      const classification: PaymentStatusClassification = {
        status: 'PARTIALLY_PAID',
        paidAmount: 60,
        total: 100,
      };

      const message = buildPaymentStatusError(classification);

      expect(message).toContain('60.00');
      expect(message).toContain('100.00');
      expect(message).toContain('40.00'); // remaining
      expect(message).toContain('cobra el resto');
    });

    it('debe generar mensaje para PARTIALLY_PAID con decimales rodeados correctamente', () => {
      const classification: PaymentStatusClassification = {
        status: 'PARTIALLY_PAID',
        paidAmount: 33.33,
        total: 100.5,
      };

      const message = buildPaymentStatusError(classification);

      expect(message).toContain('33.33');
      expect(message).toContain('100.50');
      expect(message).toContain('67.17'); // 100.5 - 33.33
    });

    it('debe generar mensaje para ZERO_OR_NEGATIVE_TOTAL', () => {
      const classification: PaymentStatusClassification = {
        status: 'ZERO_OR_NEGATIVE_TOTAL',
        paidAmount: 0,
        total: 0,
      };

      const message = buildPaymentStatusError(classification);

      expect(message).toContain('0.00');
      expect(message).toContain('no se puede fiar');
    });

    it('debe generar mensaje genérico para estado desconocido', () => {
      const classification = {
        status: 'UNKNOWN' as unknown as PaymentStatusClassification['status'],
        paidAmount: 0,
        total: 0,
      } as PaymentStatusClassification;

      const message = buildPaymentStatusError(classification);

      expect(message).toContain('desconocido');
    });
  });
});
