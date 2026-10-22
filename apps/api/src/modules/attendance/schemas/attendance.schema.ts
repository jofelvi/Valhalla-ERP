import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AttendanceDocument = HydratedDocument<Attendance>;

@Schema({ timestamps: true, collection: 'attendances' })
export class Attendance {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  employeeId: string;

  @Prop()
  userId: string;

  @Prop({ required: true })
  date: Date;

  @Prop()
  checkIn: Date;

  @Prop()
  checkOut: Date;

  @Prop()
  breakStart: Date;

  @Prop()
  breakEnd: Date;

  @Prop({ default: 0 })
  totalHours: number;

  @Prop({ default: 0 })
  overtimeHours: number;

  @Prop()
  hoursWorked: number;

  @Prop({
    default: 'present',
    enum: [
      'present',
      'absent',
      'late',
      'early_departure',
      'holiday',
      'sick_leave',
      'vacation',
      'medicalRest',
    ],
  })
  status: string;

  @Prop()
  notes: string;

  @Prop()
  photoUrl?: string;

  @Prop()
  checkOutPhotoUrl?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    checkIn?: Record<string, unknown>;
    checkOut?: Record<string, unknown>;
  };

  @Prop({ type: MongooseSchema.Types.Mixed })
  device?: {
    userAgent?: string;
    timestamp?: number;
    ipAddress?: string;
  };
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
