import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { IdentificationType } from '@odin6/types';

export type CustomerDocument = HydratedDocument<Customer>;

@Schema({ timestamps: true, collection: 'customers' })
export class Customer {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  email: string;

  @Prop()
  phone: string;

  @Prop()
  address: string;

  @Prop()
  identificationId: string;

  @Prop({
    enum: Object.values(IdentificationType),
  })
  identificationType: string;

  @Prop()
  rif: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  linkedUserId: string;

  @Prop()
  memberAction: string;

  // Dueño de la acción según el reporte del club (los demás con la misma
  // acción son beneficiarios/familiares)
  @Prop()
  isMemberPrincipal: boolean;

  // Se registró como socio con una acción que NO figura en el padrón del club.
  // Todos los socios reales ya están cargados, así que esto es una alta manual
  // que hay que revisar: NO se le da crédito hasta verificarla.
  @Prop({ default: false })
  isUnverifiedMember: boolean;

  // Nombres anteriores de la ficha (renombres del cruce con el club y fichas
  // fusionadas) — permiten seguir encontrando al cliente por su nombre viejo
  @Prop({ type: [String], default: undefined })
  nameAliases: string[];

  @Prop()
  memberCreditLimit: number;

  @Prop()
  memberCreditUsed: number;

  @Prop()
  memberCreditMonthsPaid: number;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
