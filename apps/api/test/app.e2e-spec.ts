import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../src/modules/auth/auth.module';
import { HealthController } from '../src/health.controller';

describe('POS API (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    jest.setTimeout(120000); // 2 min para descarga inicial de MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              MONGODB_URI: uri,
              JWT_SECRET: 'test-secret',
              JWT_EXPIRES_IN: '1h',
            }),
          ],
        }),
        MongooseModule.forRoot(uri),
        AuthModule,
      ],
      controllers: [HealthController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  // ─── Health Check ───
  describe('Health', () => {
    it('GET /api/health → 200', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.service).toBe('POS API');
        });
    });
  });

  // ─── Auth ───
  describe('Auth', () => {
    let accessToken: string;

    it('POST /api/auth/register → 201 crea usuario', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Admin Test',
          email: 'admin@test.com',
          password: 'Test123!',
          role: 'admin',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.email).toBe('admin@test.com');
      expect(res.body.user.role).toBe('admin');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      accessToken = res.body.accessToken;
    });

    it('POST /api/auth/register → 400 email duplicado', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Dup User',
          email: 'admin@test.com',
          password: 'Test123!',
        })
        .expect(400);
    });

    it('POST /api/auth/login → 200 credenciales validas', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Test123!' })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe('admin@test.com');
      accessToken = res.body.accessToken;
    });

    it('POST /api/auth/login → 401 password incorrecto', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'WrongPass1!' })
        .expect(401);
    });

    it('POST /api/auth/login → 401 email inexistente', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'noexiste@test.com', password: 'Test123!' })
        .expect(401);
    });

    it('GET /api/auth/me → 200 con token valido', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe('admin@test.com');
      expect(res.body.name).toBe('Admin Test');
      expect(res.body.role).toBe('admin');
    });

    it('GET /api/auth/me → 401 sin token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('POST /api/auth/refresh → 200 nuevo token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
    });
  });
});
