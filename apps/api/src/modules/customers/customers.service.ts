import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { paginar } from '../../common/paginacion.util';
import {
  condicionDeActivos,
  proyeccionPedida,
  TOPE_DE_CLIENTES,
} from './vista-de-clientes.util';

export interface FiltrosDeClientes {
  /** Solo `'lista'` recorta. Ver `vista-de-clientes.util.ts`. */
  vista?: string;
  /** `'true'` deja fuera las fichas dadas de baja. */
  activos?: string;
  limit?: string;
  page?: string;
}

// ─── helpers de búsqueda ───
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "jose" matchea "José"; "n" matchea "ñ" (el POS guarda nombres con y sin acento)
const ACCENT_CLASS: Record<string, string> = {
  a: '[aáàä]',
  e: '[eéèë]',
  i: '[iíìï]',
  o: '[oóòö]',
  u: '[uúùü]',
  n: '[nñ]',
};
const accentInsensitive = (s: string) =>
  escapeRegex(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')).replace(
    /[aeioun]/g,
    (ch) => ACCENT_CLASS[ch],
  );

// Acción del club: numérica ("211" → "00211") o con prefijo ("H0111", "DN0045")
const normalizeAction = (q: string): string | null => {
  const s = q.trim().toUpperCase();
  if (/^\d{1,5}$/.test(s)) return s.padStart(5, '0');
  if (/^[A-Z]{1,2}\d{2,5}$/.test(s)) return s;
  return null;
};

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto) {
    const customer = await this.customerModel.create(createCustomerDto);
    const obj = customer.toObject();
    return { ...obj, id: String(obj._id) };
  }

  /**
   * El padron de clientes, recortado y con techo.
   *
   * Antes: `find().lean()` sin nada. Medido en PRE el 22/09/2026, **2.955
   * clientes y 1.159.958 bytes**, pedidos por SIETE pantallas de la web. Ver
   * `vista-de-clientes.util.ts` para por que el recorte rinde tanto aca (casi
   * la mitad del peso son nombres de campo repetidos 2.955 veces) y por que el
   * techo NO es paginacion.
   */
  async findAll(filtros?: FiltrosDeClientes) {
    const query = condicionDeActivos(filtros?.activos) ?? {};
    const proyeccion = proyeccionPedida(filtros?.vista);
    const { limit, skip } = paginar(
      filtros?.limit,
      filtros?.page,
      TOPE_DE_CLIENTES,
    );

    const customers = await this.customerModel
      .find(query, proyeccion ?? undefined)
      .lean()
      .skip(skip)
      .limit(limit)
      .exec();

    if (customers.length === limit) {
      // Si esto suena, el padron paso el techo y la busqueda del navegador
      // dejo de ver a todo el mundo. La respuesta correcta es mover la
      // busqueda al servidor (`/api/customers/search` ya existe), no subir el
      // numero.
      this.logger.warn(
        `[clientes] respuesta truncada en ${limit}. El padron supero el techo: ` +
          `la busqueda del navegador ya no ve a todos. Mover la busqueda al servidor.`,
      );
    }

    return customers.map((customer) => ({ ...customer, id: customer._id }));
  }

  async findById(id: string) {
    const customer = await this.customerModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!customer) {
      throw new NotFoundException(`Cliente con id ${id} no encontrado`);
    }
    return { ...customer, id: customer._id };
  }

  async search(query: string) {
    const q = query.trim();
    const activos = { isActive: { $ne: false } };
    const sort = { isMemberPrincipal: -1 as const, name: 1 as const };

    // 1) Si parece nº de acción ("211", "00211", "H0111"), la acción exacta
    //    gana: devuelve SOLO el grupo de esa acción (dueño primero), sin ruido
    //    de cédulas/teléfonos que contengan los mismos dígitos.
    const action = normalizeAction(q);
    if (action) {
      const grupo = await this.customerModel
        .find({ ...activos, memberAction: action })
        .sort(sort)
        .lean()
        .exec();
      if (grupo.length) {
        return grupo.map((customer) => ({ ...customer, id: customer._id }));
      }
    }

    // 2) Búsqueda general
    const or: FilterQuery<CustomerDocument>[] = [];

    // Nombre y alias: multi-palabra en cualquier orden ("jose diaz" encuentra
    // "DIAZ A.JOSE G.") e insensible a acentos.
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length) {
      or.push({
        $and: tokens.map((t) => {
          const rx = accentInsensitive(t);
          return {
            $or: [
              { name: { $regex: rx, $options: 'i' } },
              { nameAliases: { $regex: rx, $options: 'i' } },
            ],
          };
        }),
      });
    }

    if (q.includes('@')) {
      or.push({ email: { $regex: escapeRegex(q), $options: 'i' } });
    }

    const digits = q.replace(/\D/g, '');
    // Teléfono: 7+ dígitos, tolerando separadores guardados ("0XXX-XXXXXXX")
    if (digits.length >= 7) {
      const rx = digits.split('').join('[-. ()]*');
      or.push({ phone: { $regex: rx } });
    }
    // Cédula/RIF: 6+ dígitos y solo desde el inicio (con o sin ceros a la
    // izquierda) — evita que "00211" matchee la cédula "212700211".
    if (digits.length >= 6 && /^[\dVEJGvejg.-]+$/.test(q)) {
      or.push({ identificationId: { $regex: `^0*${digits}` } });
    }

    if (!or.length) return [];

    const customers = await this.customerModel
      .find({ ...activos, $or: or })
      .sort(sort)
      .limit(50)
      .lean()
      .exec();
    return customers.map((customer) => ({ ...customer, id: customer._id }));
  }

  async findByMemberAction(action: string) {
    const customers = await this.customerModel
      .find({ memberAction: action })
      .sort({ isMemberPrincipal: -1, name: 1 })
      .lean()
      .exec();
    return customers.map((customer) => ({ ...customer, id: customer._id }));
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    const customer = await this.customerModel
      .findOneAndUpdate({ _id: id }, updateCustomerDto, { new: true })
      .lean()
      .exec();

    if (!customer) {
      throw new NotFoundException(`Cliente con id ${id} no encontrado`);
    }

    return { ...customer, id: customer._id };
  }

  async softDelete(id: string) {
    const customer = await this.customerModel
      .findOneAndUpdate({ _id: id }, { isActive: false }, { new: true })
      .lean()
      .exec();

    if (!customer) {
      throw new NotFoundException(`Cliente con id ${id} no encontrado`);
    }

    return { ...customer, id: customer._id };
  }
}
