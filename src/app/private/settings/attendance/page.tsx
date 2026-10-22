'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/services/api/apiClient';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Button } from '@/components/shared/button/Button';
import { Input } from '@/components/shared/input/input';
import { useToast } from '@/components/hooks/useToast';
import { ArrowLeft, MapPin, Save, Crosshair, Clock } from 'lucide-react';
import Loader from '@/components/shared/Loader/Loader';

interface AttendanceSettings {
  geofence: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    locationName: string;
  };
  standardCheckInHour: number;
  lateGraceMinutes: number;
}

interface AttendanceSettingsResponse extends Partial<AttendanceSettings> {
  /** false mientras nadie haya guardado: el servidor aun no marca "tarde". */
  configured?: boolean;
}

const DEFAULT_SETTINGS: AttendanceSettings = {
  geofence: {
    // Instalación neutra: sin coordenadas ni nombre hasta que el dueño los fije aquí.
    latitude: 0,
    longitude: 0,
    radiusMeters: 200,
    locationName: '',
  },
  standardCheckInHour: 9,
  lateGraceMinutes: 60,
};

/** "10:30" para hora 10 + 30 min de gracia (la gracia puede pasar de 60). */
const horaLimite = (hora: number, gracia: number): string => {
  const total = hora * 60 + gracia;
  const h = Math.floor(total / 60) % 24;
  return `${h}:${String(total % 60).padStart(2, '0')}`;
};

export default function AttendanceSettingsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] =
    useState<AttendanceSettings>(DEFAULT_SETTINGS);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<AttendanceSettingsResponse>(
          '/api/attendance/settings',
        );
        setSettings({
          geofence: {
            latitude:
              data.geofence?.latitude ?? DEFAULT_SETTINGS.geofence.latitude,
            longitude:
              data.geofence?.longitude ?? DEFAULT_SETTINGS.geofence.longitude,
            radiusMeters:
              data.geofence?.radiusMeters ??
              DEFAULT_SETTINGS.geofence.radiusMeters,
            locationName:
              data.geofence?.locationName ??
              DEFAULT_SETTINGS.geofence.locationName,
          },
          standardCheckInHour:
            data.standardCheckInHour ?? DEFAULT_SETTINGS.standardCheckInHour,
          lateGraceMinutes:
            data.lateGraceMinutes ?? DEFAULT_SETTINGS.lateGraceMinutes,
        });
        setConfigured(data.configured === true);
      } catch {
        // Antes esto caia a localStorage en silencio y la pantalla mostraba
        // valores que no eran los del servidor. Ahora se dice.
        toast.error({
          title: 'No se pudo cargar',
          description:
            'Se muestran los valores por defecto; no son necesariamente los guardados.',
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error({
        title: 'No soportado',
        description: 'Tu navegador no soporta geolocalización',
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSettings((prev) => ({
          ...prev,
          geofence: {
            ...prev.geofence,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
        }));
        toast.success({
          title: 'Ubicación capturada',
          description: 'Coordenadas actualizadas con tu posición actual',
        });
      },
      (err) => {
        toast.error({ title: 'Error', description: err.message });
      },
      { enableHighAccuracy: true },
    );
  };

  const handleSave = async () => {
    // Validaciones
    if (settings.geofence.latitude < -90 || settings.geofence.latitude > 90) {
      toast.error({
        title: 'Latitud inválida',
        description: 'Debe estar entre -90 y 90',
      });
      return;
    }
    if (
      settings.geofence.longitude < -180 ||
      settings.geofence.longitude > 180
    ) {
      toast.error({
        title: 'Longitud inválida',
        description: 'Debe estar entre -180 y 180',
      });
      return;
    }
    if (
      settings.geofence.radiusMeters < 10 ||
      settings.geofence.radiusMeters > 5000
    ) {
      toast.error({
        title: 'Radio inválido',
        description: 'Debe estar entre 10 y 5000 metros',
      });
      return;
    }
    if (settings.standardCheckInHour < 0 || settings.standardCheckInHour > 23) {
      toast.error({
        title: 'Hora inválida',
        description: 'Debe estar entre 0 y 23',
      });
      return;
    }

    setSaving(true);
    try {
      await api.patch('/api/attendance/settings', {
        geofence: settings.geofence,
        standardCheckInHour: settings.standardCheckInHour,
        lateGraceMinutes: settings.lateGraceMinutes,
      });
      setConfigured(true);
      toast.success({
        title: 'Guardado',
        description: 'Configuración de asistencia actualizada',
      });
    } catch (err) {
      // Sin "guardado local": un ajuste que no llega al servidor no lo ve
      // ningun telefono, y decir que se guardo era mentir.
      const detalle = err instanceof Error ? err.message : '';
      toast.error({
        title: 'No se guardó',
        description: detalle.includes('400')
          ? 'Algún valor está fuera de rango.'
          : 'No se pudo guardar la configuración. Inténtalo de nuevo.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader text="Cargando configuración..." />;

  const mapUrl = `https://www.openstreetmap.org/?mlat=${settings.geofence.latitude}&mlon=${settings.geofence.longitude}#map=17/${settings.geofence.latitude}/${settings.geofence.longitude}`;

  return (
    <div className="min-h-screen bg-page">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/private/settings">
              <Button variant="ghost" size="sm" className="mb-2">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Volver
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-content">
              Configuración de Asistencia
            </h1>
            <p className="text-dim">
              Define el área del club y parámetros de check-in
            </p>
          </div>
          <Button
            onClick={() => void handleSave()}
            disabled={saving}
            className="bg-gradient-to-r from-brand/10 to-ok/5 hover:from-brand/10 hover:to-ok/5 text-brand"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Geofence Config */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-content">
                <MapPin className="w-5 h-5" />
                Área del Club (Geofence)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-dim mb-1 block">
                  Nombre de la ubicación
                </label>
                <Input
                  type="text"
                  value={settings.geofence.locationName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      geofence: {
                        ...prev.geofence,
                        locationName: e.target.value,
                      },
                    }))
                  }
                  placeholder="Ej: Dirección del local"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-dim mb-1 block">
                    Latitud
                  </label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={settings.geofence.latitude}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        geofence: {
                          ...prev.geofence,
                          latitude: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-dim mb-1 block">
                    Longitud
                  </label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={settings.geofence.longitude}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        geofence: {
                          ...prev.geofence,
                          longitude: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-line text-dim hover:bg-elevated"
                onClick={handleUseCurrentLocation}
              >
                <Crosshair className="w-4 h-4 mr-2" />
                Usar mi ubicación actual
              </Button>

              <div>
                <label className="text-sm font-medium text-dim mb-1 block">
                  Radio del geofence (metros)
                </label>
                <Input
                  type="number"
                  min={10}
                  max={5000}
                  value={settings.geofence.radiusMeters}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      geofence: {
                        ...prev.geofence,
                        radiusMeters: parseInt(e.target.value) || 0,
                      },
                    }))
                  }
                />
                <p className="text-xs text-dim mt-1">
                  El empleado debe estar dentro de este radio desde el centro
                  para poder marcar asistencia. Recomendado: 100-300 metros.
                </p>
              </div>

              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2 text-sm text-brand hover:text-content underline"
              >
                Ver en mapa (OpenStreetMap) →
              </a>
            </CardContent>
          </Card>

          {/* Horario y reglas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-content">
                <Clock className="w-5 h-5" />
                Horario y Reglas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-dim mb-1 block">
                  Hora estándar de entrada (0-23)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.standardCheckInHour}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      standardCheckInHour: parseInt(e.target.value) || 0,
                    }))
                  }
                />
                <p className="text-xs text-dim mt-1">
                  Hora a la que los empleados deben llegar. Actualmente:{' '}
                  {settings.standardCheckInHour}:00
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-dim mb-1 block">
                  Minutos de gracia antes de contar como tarde
                </label>
                <Input
                  type="number"
                  min={0}
                  max={180}
                  value={settings.lateGraceMinutes}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      lateGraceMinutes: parseInt(e.target.value) || 0,
                    }))
                  }
                />
                <p className="text-xs text-dim mt-1">
                  Si ficha entrada después de las{' '}
                  {horaLimite(
                    settings.standardCheckInHour,
                    settings.lateGraceMinutes,
                  )}{' '}
                  (hora de Venezuela) se marcará como tarde.
                </p>
              </div>

              <div className="mt-6 p-4 bg-accent/15 border border-accent/20 rounded-lg">
                <p className="text-sm font-semibold text-accent mb-1">
                  ⚠️ Importante
                </p>
                <p className="text-xs text-accent">
                  {configured
                    ? 'Estos ajustes están guardados en el servidor y ya marcan las llegadas tarde.'
                    : 'Todavía no se han guardado: hasta que pulses "Guardar Cambios" nadie se marca como tarde.'}{' '}
                  La app lee la geocerca al abrir la pantalla de asistencia
                  (puede tardar hasta 5 minutos en tomar un cambio) y solo desde
                  la versión de la app que ya la lee del servidor; las
                  anteriores siguen con la que traían.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
