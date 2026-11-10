import { validate } from 'class-validator';
import { ConfirmOrderDto } from './confirm-order.dto';

function createDto(name: string, email: string): ConfirmOrderDto {
  return Object.assign(new ConfirmOrderDto(), { name, email });
}

describe('ConfirmOrderDto', () => {
  it('accepts a non-empty name and a valid email', async () => {
    const errors = await validate(createDto('Ana Pérez', 'ana@example.com'));

    expect(errors).toHaveLength(0);
  });

  it.each(['', '   '])('rejects an empty name (%p)', async (name) => {
    const errors = await validate(createDto(name, 'ana@example.com'));

    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it.each(['', 'correo-invalido', 'ana@'])(
    'rejects an invalid email (%p)',
    async (email) => {
      const errors = await validate(createDto('Ana Pérez', email));

      expect(errors.some((error) => error.property === 'email')).toBe(true);
    },
  );
});
