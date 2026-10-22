import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { APP_VERSION, BUILD_TIME, COMMIT_SHA } from './version.generated';

/**
 * Health y version del API.
 *
 * `version` estuvo devolviendo el literal '1.0.0' desde que se escribio este
 * archivo: no decia nada del codigo que realmente estaba corriendo. Ahora sale
 * de `version.generated.ts`, que se escribe en cada `pnpm build` con el SHA del
 * commit compilado — asi la respuesta no puede desmentir al binario que la emite.
 *
 * Ambas rutas son publicas a proposito: el punto es poder verificar un despliegue
 * con un `curl` sin token, que es cuando mas falta hace.
 */
@ApiTags('health')
@Controller()
export class HealthController {
  @Get('api/health')
  @ApiOperation({ summary: 'Health check del API' })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'POS API',
      version: APP_VERSION,
    };
  }

  @Get('api/version')
  @ApiOperation({ summary: 'Version, commit y fecha de build del API' })
  getVersion() {
    return {
      app: 'api',
      version: APP_VERSION,
      sha: COMMIT_SHA,
      buildTime: BUILD_TIME,
    };
  }
}
