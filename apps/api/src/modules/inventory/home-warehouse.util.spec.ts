import { homeAreaOf } from './home-warehouse.util';

describe('homeAreaOf — la casa del stock de un producto', () => {
  it('las bebidas de barra viven en la Barra', () => {
    expect(homeAreaOf({ station: 'BAR' })).toBe('BARRA');
  });

  it('cocina y pizza viven en la Cocina', () => {
    expect(homeAreaOf({ station: 'KITCHEN' })).toBe('COCINA');
    expect(homeAreaOf({ station: 'PIZZA' })).toBe('COCINA');
  });

  it('sin estación no se adivina', () => {
    expect(homeAreaOf({})).toBeNull();
    expect(homeAreaOf({ station: null })).toBeNull();
    expect(homeAreaOf({ station: 'OTRA' })).toBeNull();
  });
});
