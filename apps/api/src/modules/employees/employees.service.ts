import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Employee, EmployeeDocument } from './schemas/employee.schema';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name) private employeeModel: Model<EmployeeDocument>,
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    const employee = await this.employeeModel.create(createEmployeeDto);
    const obj = employee.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async findAll(query?: { active?: boolean }) {
    let dbQuery = this.employeeModel.find();

    if (query?.active !== undefined) {
      dbQuery = dbQuery.where('isActive').equals(query.active);
    }

    const employees = await dbQuery.lean().exec();
    return employees.map((employee) => ({ ...employee, id: employee._id }));
  }

  async findById(id: string) {
    const employee = await this.employeeModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!employee) {
      throw new NotFoundException(`Empleado con id ${id} no encontrado`);
    }
    return { ...employee, id: employee._id };
  }

  async findByEmail(email: string) {
    const employee = await this.employeeModel.findOne({ email }).lean().exec();
    if (!employee) {
      throw new NotFoundException(`Empleado con email ${email} no encontrado`);
    }
    return { ...employee, id: employee._id };
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    const employee = await this.employeeModel
      .findOneAndUpdate({ _id: id }, updateEmployeeDto, { new: true })
      .lean()
      .exec();

    if (!employee) {
      throw new NotFoundException(`Empleado con id ${id} no encontrado`);
    }

    return { ...employee, id: employee._id };
  }

  async softDelete(id: string) {
    const employee = await this.employeeModel
      .findOneAndUpdate({ _id: id }, { isActive: false }, { new: true })
      .lean()
      .exec();

    if (!employee) {
      throw new NotFoundException(`Empleado con id ${id} no encontrado`);
    }

    return { ...employee, id: employee._id };
  }
}
