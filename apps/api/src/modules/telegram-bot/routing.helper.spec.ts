import { destinoDeFoto, esAccionable, esMiembroDelGrupo, imagenDelMensaje, nombreDeSocio } from './routing.helper';

describe('destinoDeFoto', () => {
  it('en privado todo pasa en el mismo chat', () => {
    expect(destinoDeFoto({ id: 8541283820, type: 'private' }, 8541283820)).toEqual({
      destino: 8541283820,
      avisarEn: null,
    });
  });

  it('en el grupo avisa alli y pregunta por el privado del socio', () => {
    // El grupo ve entrar la factura; las diez preguntas van al chat de Jonathan.
    expect(destinoDeFoto({ id: -5188960709, type: 'group' }, 8541283820)).toEqual({
      destino: 8541283820,
      avisarEn: -5188960709,
    });
  });

  it('un supergrupo se trata igual que un grupo', () => {
    expect(destinoDeFoto({ id: -1001234567890, type: 'supergroup' }, 77)).toEqual({
      destino: 77,
      avisarEn: -1001234567890,
    });
  });

  it('sin remitente no hay a donde mudar la conversacion: se descarta', () => {
    expect(destinoDeFoto({ id: -5188960709, type: 'group' })).toBeNull();
  });
});

describe('esAccionable', () => {
  it('una foto y un boton siempre lo son', () => {
    expect(esAccionable({ tieneFoto: true, esCallback: false })).toBe(true);
    expect(esAccionable({ tieneFoto: false, esCallback: true })).toBe(true);
  });

  it('un comando lo es, aunque venga con espacios delante', () => {
    expect(esAccionable({ tieneFoto: false, texto: '/informe', esCallback: false })).toBe(true);
    expect(esAccionable({ tieneFoto: false, texto: '  /hoy', esCallback: false })).toBe(true);
  });

  it('la conversacion del grupo NO lo es: sin log ni respuesta', () => {
    // Con el modo privacidad apagado, esto es la mayoria de lo que llega.
    expect(esAccionable({ tieneFoto: false, texto: 'ok dale', esCallback: false })).toBe(false);
    expect(esAccionable({ tieneFoto: false, texto: '', esCallback: false })).toBe(false);
    expect(esAccionable({ tieneFoto: false, esCallback: false })).toBe(false);
  });
});

describe('alta automatica por estar en el grupo', () => {
  it('cuenta a quien esta hoy en el grupo, silenciado incluido', () => {
    expect(esMiembroDelGrupo({ status: 'member' })).toBe(true);
    expect(esMiembroDelGrupo({ status: 'administrator' })).toBe(true);
    expect(esMiembroDelGrupo({ status: 'creator' })).toBe(true);
    expect(esMiembroDelGrupo({ status: 'restricted', is_member: true })).toBe(true);
  });

  it('no cuenta a quien salio o lo sacaron', () => {
    expect(esMiembroDelGrupo({ status: 'left' })).toBe(false);
    expect(esMiembroDelGrupo({ status: 'kicked' })).toBe(false);
    expect(esMiembroDelGrupo({ status: 'restricted', is_member: false })).toBe(false);
  });

  it('el nombre del socio no se repite con uno que ya existe', () => {
    expect(nombreDeSocio('Mariale', 'Medina', ['Jonathan'])).toBe('Mariale');
    expect(nombreDeSocio('Mariale', 'Medina', ['Jonathan', 'mariale'])).toBe('Mariale M.');
    expect(nombreDeSocio('Mariale', 'Medina', ['Mariale', 'Mariale M.'])).toBe('Mariale M. 2');
    expect(nombreDeSocio('Mariale', undefined, ['Mariale'])).toBe('Mariale 2');
    expect(nombreDeSocio('  ', undefined, [])).toBe('Socio');
  });
});

describe('imagenDelMensaje: foto o archivo', () => {
  it('de una foto toma la de mayor resolucion', () => {
    expect(imagenDelMensaje({ photo: [{ file_id: 'chica' }, { file_id: 'grande' }] })).toEqual({ fileId: 'grande', extension: 'jpg' });
  });

  it('un jpg mandado como archivo tambien es una factura', () => {
    expect(imagenDelMensaje({ document: { file_id: 'd1', mime_type: 'image/jpeg', file_name: 'IMG_2026.jpg' } })).toEqual({ fileId: 'd1', extension: 'jpg' });
    expect(imagenDelMensaje({ document: { file_id: 'd2', file_name: 'factura.JPEG' } })).toEqual({ fileId: 'd2', extension: 'jpg' });
    expect(imagenDelMensaje({ document: { file_id: 'd3', mime_type: 'image/png' } })).toEqual({ fileId: 'd3', extension: 'png' });
  });

  it('otros archivos no', () => {
    expect(imagenDelMensaje({ document: { file_id: 'x', mime_type: 'application/pdf', file_name: 'a.pdf' } })).toBeNull();
    expect(imagenDelMensaje({})).toBeNull();
    expect(imagenDelMensaje(undefined)).toBeNull();
  });
});
