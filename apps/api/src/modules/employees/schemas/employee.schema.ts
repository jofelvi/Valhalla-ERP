import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EmployeeDocument = HydratedDocument<Employee>;

@Schema({ timestamps: true, collection: 'employees' })
export class Employee {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop()
  userId: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  phone: string;

  @Prop()
  address: string;

  @Prop()
  position: string;

  @Prop()
  department: string;

  @Prop()
  hireDate: Date;

  @Prop()
  salary: number;

  @Prop({ default: true })
  isActive: boolean;

  // Si cobra por comisiones (mesonero: días×monto + comisiones + propinas).
  // Si es false/undefined, cobra por sueldo base semanal (cocina, barra, etc.).
  @Prop()
  esMesonero?: boolean;

  @Prop()
  pin: string;

  @Prop()
  customerId?: string;

  @Prop()
  photoUrl: string;

  @Prop()
  observations: string;

  @Prop({
    type: {
      bloodType: String,
      allergies: String,
      conditions: String,
      notes: String,
    },
  })
  medicalInfo?: {
    bloodType?: string;
    allergies?: string;
    conditions?: string;
    notes?: string;
  };

  @Prop([
    {
      id: String,
      type: String,
      name: String,
      url: String,
      expiryDate: String,
      uploadedAt: String,
      notes: String,
    },
  ])
  documents?: Array<{
    id: string;
    type: string;
    name: string;
    url: string;
    expiryDate?: string;
    uploadedAt: string;
    notes?: string;
  }>;

  @Prop({
    type: {
      name: String,
      phone: String,
      relationship: String,
    },
    required: false,
  })
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };

  @Prop({
    type: {
      accountNumber: String,
      bankName: String,
      accountType: String,
    },
  })
  bankAccount?: {
    accountNumber?: string;
    bankName?: string;
    accountType?: string;
  };
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
