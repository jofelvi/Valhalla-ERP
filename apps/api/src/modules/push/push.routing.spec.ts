import { PushService } from './push.service';
import type { ApnsService } from './apns.service';

/**
 * Ruteo por plataforma en sendToUsers: iOS -> APNs, resto -> FCM. Se prueba con
 * FCM apagado (sin service account) para aislar la rama APNs y la limpieza de
 * tokens muertos.
 */
describe('PushService - ruteo iOS/Android', () => {
  const payload = { title: 'x', body: 'y', data: { orderId: 'o1' } };

  function build(
    apnsMock: Partial<ApnsService>,
    tokens: Array<{ token: string; platform: string }>,
  ) {
    const userModel = {
      find: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve([{ pushTokens: tokens }]) }),
      }),
      updateMany: jest.fn().mockResolvedValue({}),
    };
    // Sin FCM configurado: this.enabled = false (account null).
    const configService = { get: jest.fn().mockReturnValue(undefined) };
    const service = new PushService(
      userModel as never,
      configService as never,
      apnsMock as ApnsService,
    );
    return { service, userModel };
  }

  it('entrega el token iOS por APNs y omite Android cuando FCM esta apagado', async () => {
    const apns = {
      enabled: true,
      sendToToken: jest
        .fn()
        .mockResolvedValue({ ok: true, unregistered: false }),
    };
    const { service } = build(apns, [
      { token: 'ios-1', platform: 'ios' },
      { token: 'and-1', platform: 'android' },
    ]);

    const ok = await service.sendToUsers(['u1'], payload);

    expect(apns.sendToToken).toHaveBeenCalledTimes(1);
    expect(apns.sendToToken).toHaveBeenCalledWith('ios-1', payload);
    expect(ok).toBe(1); // el Android se omite porque no hay FCM
  });

  it('limpia el token iOS cuando APNs lo reporta muerto', async () => {
    const apns = {
      enabled: true,
      sendToToken: jest
        .fn()
        .mockResolvedValue({ ok: false, unregistered: true }),
    };
    const { service, userModel } = build(apns, [
      { token: 'ios-dead', platform: 'ios' },
    ]);

    const ok = await service.sendToUsers(['u1'], payload);

    expect(ok).toBe(0);
    expect(userModel.updateMany).toHaveBeenCalledWith(
      { 'pushTokens.token': 'ios-dead' },
      { $pull: { pushTokens: { token: 'ios-dead' } } },
    );
  });

  it('no hace nada si no hay ningun canal habilitado', async () => {
    const apns = { enabled: false, sendToToken: jest.fn() };
    const { service } = build(apns, [{ token: 'ios-1', platform: 'ios' }]);

    const ok = await service.sendToUsers(['u1'], payload);

    expect(ok).toBe(0);
    expect(apns.sendToToken).not.toHaveBeenCalled();
  });
});
