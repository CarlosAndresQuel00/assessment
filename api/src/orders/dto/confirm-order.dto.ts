import { IsEmail, IsString, Matches } from 'class-validator';

export class ConfirmOrderDto {
  @IsString()
  @Matches(/\S/, { message: 'El nombre es obligatorio' })
  name: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email: string;
}
