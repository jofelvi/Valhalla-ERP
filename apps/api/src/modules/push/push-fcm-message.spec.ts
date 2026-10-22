import { buildFcmMessage } from './push-fcm-message';

describe('buildFcmMessage', () => {
  const base = { title: 'Listo · Mesa 4', body: 'Ana · 2x Tequenos' };

  it('incluye notification, android y apns', () => {
    const m = buildFcmMessage('tok-1', {
      ...base,
      data: { orderId: 'o1' },
    }).message;
    expect(m.token).toBe('tok-1');
    expect(m.notification).toEqual({ title: base.title, body: base.body });
    expect(m.android.notification.channel_id).toBe('kitchen');
    expect(m.android.notification.tag).toBe('o1');
    expect(m.apns.payload.aps.sound).toBe('default');
    expect(m.apns.headers['apns-priority']).toBe('10');
    expect(m.apns.headers['apns-collapse-id']).toBe('o1');
  });

  it('usa el channelId dado y agrupa por orderId en el tag', () => {
    const m = buildFcmMessage('t', {
      ...base,
      channelId: 'orders',
      data: { orderId: 'x' },
    }).message;
    expect(m.android.notification.channel_id).toBe('orders');
    expect(m.android.notification.tag).toBe('x');
  });

  it('sin data usa objeto vacio y tag por defecto', () => {
    const m = buildFcmMessage('t', base).message;
    expect(m.data).toEqual({});
    expect(m.android.notification.tag).toBe('kitchen');
    expect(m.apns.headers['apns-collapse-id']).toBe('kitchen');
  });
});
