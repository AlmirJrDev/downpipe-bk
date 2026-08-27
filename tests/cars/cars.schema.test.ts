import { describe, expect, it } from 'vitest';
import { createCarSchema, updateCarSchema, listCarsQuerySchema } from '@/modules/cars/cars.schema';

describe('createCarSchema', () => {
  it('aceita um payload mínimo vazio (todos os campos são opcionais)', () => {
    expect(createCarSchema.safeParse({}).success).toBe(true);
  });

  it('aceita um payload completo válido', () => {
    const result = createCarSchema.safeParse({
      vehicleVersionId: '123e4567-e89b-12d3-a456-426614174000',
      version: 'GTI',
      engine: '2.0 TSI',
      power: 230,
      torque: 350,
      transmission: 'Manual',
      drivetrain: 'FWD',
      mileage: 45000,
      description: 'Projeto Stage 2',
      status: 'building',
      category: 'Euro',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita status fora do enum permitido', () => {
    const result = createCarSchema.safeParse({ status: 'finished' });
    expect(result.success).toBe(false);
  });

  it('rejeita category fora do enum permitido', () => {
    const result = createCarSchema.safeParse({ category: 'Tuning' });
    expect(result.success).toBe(false);
  });

  it('rejeita tentativa de enviar project_progress diretamente (campo não existe no schema)', () => {
    const result = createCarSchema.safeParse({ project_progress: 50 });
    expect(result.success).toBe(false);
  });

  it('rejeita mileage negativo', () => {
    const result = createCarSchema.safeParse({ mileage: -10 });
    expect(result.success).toBe(false);
  });
});

describe('updateCarSchema', () => {
  it('rejeita objeto vazio (nada para atualizar)', () => {
    expect(updateCarSchema.safeParse({}).success).toBe(false);
  });

  it('aceita atualização parcial válida', () => {
    expect(updateCarSchema.safeParse({ mileage: 50000 }).success).toBe(true);
  });

  it('rejeita tentativa de alterar amount_invested diretamente', () => {
    const result = updateCarSchema.safeParse({ amount_invested: 99999 });
    expect(result.success).toBe(false);
  });
});

describe('listCarsQuerySchema', () => {
  it('aceita query vazia', () => {
    expect(listCarsQuerySchema.safeParse({}).success).toBe(true);
  });

  it('aceita filtros válidos', () => {
    expect(listCarsQuerySchema.safeParse({ category: 'JDM', status: 'planning' }).success).toBe(
      true
    );
  });

  it('rejeita filtro de categoria inválida', () => {
    expect(listCarsQuerySchema.safeParse({ category: 'Invalida' }).success).toBe(false);
  });
});
