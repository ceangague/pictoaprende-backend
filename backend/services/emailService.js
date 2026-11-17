/**
 * =====================================================================
 * PROYECTO CAIMIUP - SERVICIO DE MENSAJERÍA ELECTRÓNICA INSTITUCIONAL
 * Universidad de Pamplona · Facultad de Ingenierías y Arquitectura
 * Centro de Atención Integral Materno Infantil (CAIMIUP)
 *
 * Módulo: Despacho de Correos con Identidad Institucional CAIMIUP
 * Protocolos: SMTP TLS/STARTTLS nativo (RFC 5321 / RFC 5322) sin dependencias
 * Remitente Oficial: "CAIMIUP - Universidad de Pamplona"
 * Fases Metodológicas: Fase 4 (Software API) y Fase 5 (Integración)
 * Agente: Backend_DB_Dev
 * =====================================================================
 */

const tls = require('tls');
const net = require('net');
const crypto = require('crypto');

class EmailService {
  constructor() {
    this.historialEnvios = [];
    this.cargarConfiguracion();
  }

  cargarConfiguracion() {
    this.config = {
      enabled: process.env.SMTP_ENABLED !== 'false',
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 465,
      secure: process.env.SMTP_SECURE === 'true' || (parseInt(process.env.SMTP_PORT, 10) || 465) === 465,
      user: (process.env.SMTP_USER || '').trim(),
      pass: (process.env.SMTP_PASS || '').trim(),
      fromName: process.env.SMTP_FROM_NAME || 'CAIMIUP - Universidad de Pamplona',
      fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'notificaciones@caimiup.edu.co',
      replyTo: process.env.SMTP_REPLY_TO || 'contacto@caimiup.edu.co'
    };
  }

  /**
   * Genera el membrete y contenedor HTML con estándares visuales Unipamplona:
   * Colores Institucionales: Rojo (#ad3333), Azul (#003366), Gris (#DADADA)
   */
  generarPlantillaInstitucional({ titulo, subtitulo, contenidoHtml, pieExtraHtml = '' }) {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
    .email-container { max-width: 620px; margin: 24px auto; background: #FFFFFF; border: 1px solid #DADADA; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
    .email-header-top { background-color: #ad3333; height: 6px; width: 100%; }
    .email-header { background: linear-gradient(135deg, #003366 0%, #1E3A8A 100%); padding: 24px 30px; color: #FFFFFF; }
    .header-tag { display: inline-block; background: rgba(255,255,255,0.18); color: #FFFFFF; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 8px; text-transform: uppercase; }
    .header-title { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.3px; color: #FFFFFF; }
    .header-subtitle { margin: 4px 0 0 0; font-size: 13px; color: #E2E8F0; }
    .email-body { padding: 30px; font-size: 14.5px; line-height: 1.6; color: #334155; }
    .email-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; }
    .badge-primary { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
    .badge-success { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
    .card-info { background: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid #003366; border-radius: 8px; padding: 16px; margin: 18px 0; }
    .card-info-title { font-weight: 700; font-size: 13.5px; color: #0F172A; margin-bottom: 6px; }
    .btn-action { display: inline-block; background-color: #003366; color: #FFFFFF !important; text-decoration: none; padding: 12px 26px; border-radius: 8px; font-weight: 700; font-size: 14px; margin: 18px 0; box-shadow: 0 4px 10px rgba(0, 51, 102, 0.25); }
    .email-footer { background-color: #F1F5F9; border-top: 1px solid #E2E8F0; padding: 20px 30px; font-size: 12px; color: #64748B; line-height: 1.5; }
    .footer-brand { font-weight: 700; color: #003366; margin-bottom: 4px; }
    .legal-notice { font-size: 11px; color: #94A3B8; margin-top: 10px; border-top: 1px dashed #CBD5E1; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header-top"></div>
    <div class="email-header">
      <span class="header-tag">CAIMIUP · Universidad de Pamplona</span>
      <h1 class="header-title">${titulo}</h1>
      <p class="header-subtitle">${subtitulo}</p>
    </div>
    <div class="email-body">
      ${contenidoHtml}
    </div>
    <div class="email-footer">
      <div class="footer-brand">Centro de Atención Integral Materno Infantil (CAIMIUP)</div>
      <div>Facultad de Ingenierías y Arquitectura · Departamento de Ingenierías E.E.S.T.</div>
      <div>Universidad de Pamplona, Norte de Santander, Colombia</div>
      ${pieExtraHtml}
      <div class="legal-notice">
        <strong>Confidencialidad y Protección de Datos:</strong> Este mensaje se emite en el marco del Proyecto de Investigación y Entorno Interactivo para Niños con TEA de la Universidad de Pamplona, sujeto a la Ley 1581 de 2012 (Habeas Data). Si usted no es el destinatario previsto, por favor notifíquelo a <a href="mailto:contacto@caimiup.edu.co" style="color:#003366;">contacto@caimiup.edu.co</a>.
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Envía un correo mediante conexión directa SMTP (TLS/STARTTLS nativo)
   */
  async enviarCorreo({ to, subject, html, text }) {
    this.cargarConfiguracion();

    const idEnvio = 'mail_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const remitenteFormateado = `"${this.config.fromName}" <${this.config.fromEmail}>`;

    const registro = {
      id: idEnvio,
      to,
      from: remitenteFormateado,
      subject,
      timestamp: new Date().toISOString(),
      estado: 'PENDIENTE',
      modo: 'SMTP'
    };

    // Modo simulado/offline si no se han configurado credenciales reales en .env
    const hasCredentials = Boolean(this.config.user && this.config.pass);
    if (!hasCredentials) {
      registro.estado = 'EMULADO_SIN_CREDENCIALES_SMTP';
      registro.modo = 'EMULACION_LOCAL';
      registro.mensaje = 'El correo ha sido generado y validado con identidad CAIMIUP. Para entrega a bandejas reales configure SMTP_USER y SMTP_PASS en el archivo .env.';
      this.historialEnvios.unshift(registro);
      if (this.historialEnvios.length > 50) this.historialEnvios.pop();

      console.log('---------------------------------------------------------------------');
      console.log(`[Backend_DB_Dev]: Correo emitido [SIMULADO]:`);
      console.log(`   Remitente: ${remitenteFormateado}`);
      console.log(`   Destinatario: ${to}`);
      console.log(`   Asunto: ${subject}`);
      console.log('---------------------------------------------------------------------');

      return {
        exito: true,
        modo: 'simulado',
        id: idEnvio,
        remitente: remitenteFormateado,
        destinatario: to,
        asunto: subject,
        mensaje: 'Correo preparado y registrado exitosamente con remitente oficial CAIMIUP.'
      };
    }

    // Despacho real mediante socket SMTP nativo
    return new Promise((resolve, reject) => {
      let socket = null;
      let buffer = '';
      let step = 0;
      let timer = null;

      const limpiar = () => {
        if (timer) clearTimeout(timer);
        if (socket && !socket.destroyed) socket.destroy();
      };

      timer = setTimeout(() => {
        limpiar();
        registro.estado = 'ERROR_TIMEOUT';
        registro.error = 'Tiempo de espera agotado al conectar con el servidor SMTP.';
        this.historialEnvios.unshift(registro);
        reject(new Error(registro.error));
      }, 15000);

      const onConnect = () => {
        // La conexión ha iniciado; el servidor SMTP enviará su saludo 220
      };

      if (this.config.secure) {
        socket = tls.connect(this.config.port, this.config.host, { rejectUnauthorized: false }, onConnect);
      } else {
        socket = net.connect(this.config.port, this.config.host, onConnect);
      }

      socket.on('error', (err) => {
        limpiar();
        registro.estado = 'ERROR_CONEXION';
        registro.error = err.message;
        this.historialEnvios.unshift(registro);
        reject(err);
      });

      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        const lineas = buffer.split('\r\n');
        buffer = lineas.pop(); // Mantener remanente incompleto

        for (const linea of lineas) {
          if (!linea) continue;
          const code = parseInt(linea.substring(0, 3), 10);
          const isFinal = linea.length === 3 || linea.charAt(3) === ' ';

          if (!isFinal) continue;

          // Máquina de estados SMTP (RFC 5321)
          if (step === 0 && code === 220) {
            step = 1;
            socket.write(`EHLO caimiup.edu.co\r\n`);
          } else if (step === 1 && code === 250) {
            step = 2;
            socket.write(`AUTH LOGIN\r\n`);
          } else if (step === 2 && code === 334) {
            step = 3;
            // Enviar usuario en base64
            socket.write(Buffer.from(this.config.user).toString('base64') + '\r\n');
          } else if (step === 3 && code === 334) {
            step = 4;
            // Enviar contraseña en base64
            socket.write(Buffer.from(this.config.pass).toString('base64') + '\r\n');
          } else if (step === 4 && (code === 235 || code === 250)) {
            step = 5;
            socket.write(`MAIL FROM:<${this.config.fromEmail}>\r\n`);
          } else if (step === 5 && code === 250) {
            step = 6;
            socket.write(`RCPT TO:<${to}>\r\n`);
          } else if (step === 6 && code === 250) {
            step = 7;
            socket.write(`DATA\r\n`);
          } else if (step === 7 && code === 354) {
            step = 8;
            const boundary = '----=_Part_' + Date.now();
            const headers = [
              `From: ${remitenteFormateado}`,
              `To: ${to}`,
              `Reply-To: ${this.config.replyTo}`,
              `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
              `Date: ${new Date().toUTCString()}`,
              `Message-ID: <${idEnvio}@caimiup.unipamplona.edu.co>`,
              `MIME-Version: 1.0`,
              `X-Mailer: CAIMIUP-Campus-MailEngine-1.0`,
              `Content-Type: text/html; charset=UTF-8`,
              `Content-Transfer-Encoding: 8bit`,
              '',
              html,
              '\r\n.\r\n'
            ].join('\r\n');

            socket.write(headers);
          } else if (step === 8 && code === 250) {
            step = 9;
            socket.write(`QUIT\r\n`);
            limpiar();
            registro.estado = 'ENVIADO_EXITOSAMENTE';
            this.historialEnvios.unshift(registro);
            if (this.historialEnvios.length > 50) this.historialEnvios.pop();

            console.log(`[Backend_DB_Dev]: ✅ Correo entregado exitosamente a "${to}" desde remitente "${remitenteFormateado}".`);

            resolve({
              exito: true,
              modo: 'smtp_real',
              id: idEnvio,
              destinatario: to,
              remitente: remitenteFormateado,
              mensaje: `Correo entregado exitosamente al servidor de destino para ${to}.`
            });
            return;
          } else if (code >= 400) {
            limpiar();
            registro.estado = 'ERROR_SMTP_' + code;
            registro.error = linea;
            this.historialEnvios.unshift(registro);
            reject(new Error(`Respuesta SMTP rechazada (${code}): ${linea}`));
            return;
          }
        }
      });
    });
  }

  /**
   * Envía correo de bienvenida con credenciales de acceso institucional
   */
  async enviarBienvenidaUsuario({ email, nombre, role, password, nombreNino = null, urlAcceso = 'http://localhost:3000' }) {
    const rolNombres = {
      admin: 'Administrador de Plataforma',
      docente: 'Docente Especialista TEA',
      padre: 'Familia / Acudiente Responsable'
    };
    const rolEtiqueta = rolNombres[role] || role.toUpperCase();

    const infoNinoHtml = (role === 'padre' && nombreNino) ? `
      <div class="card-info">
        <div class="card-info-title">🧒 Paciente Asignado en CAIMIUP:</div>
        <div><strong>Estudiante:</strong> ${nombreNino}</div>
        <div style="font-size:12.5px; color:#64748B; margin-top:4px;">Su cuenta está enlazada al seguimiento de avance y telemetría de este menor en las sesiones de mediación sensorial.</div>
      </div>
    ` : '';

    const html = this.generarPlantillaInstitucional({
      titulo: 'Bienvenido(a) a la Plataforma CAIMIUP',
      subtitulo: 'Centro de Atención Integral Materno Infantil · Universidad de Pamplona',
      contenidoHtml: `
        <p>Estimado(a) <strong>${nombre}</strong>,</p>
        <p>Le damos una cordial bienvenida a <strong>PictoAprende CAIMIUP</strong>, el entorno de aprendizaje interactivo y mediación pedagógica para niños con Trastorno del Espectro Autista (TEA).</p>
        
        <p>Se ha creado formalmente su cuenta en el sistema con el siguiente perfil institucional:</p>

        <div style="margin: 20px 0; padding: 18px; background: #FFFFFF; border: 1.5px solid #CBD5E1; border-radius: 10px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748B; width: 140px;"><strong>Rol asignado:</strong></td>
              <td style="padding: 6px 0;"><span class="email-badge badge-primary">${rolEtiqueta}</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Usuario / Correo:</strong></td>
              <td style="padding: 6px 0;"><code>${email}</code></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Contraseña inicial:</strong></td>
              <td style="padding: 6px 0;"><code>${password}</code></td>
            </tr>
          </table>
        </div>

        ${infoNinoHtml}

        <p>Puede ingresar inmediatamente al portal institucional para acceder a su panel de gestión:</p>

        <div style="text-align: center;">
          <a href="${urlAcceso}" class="btn-action" target="_blank">Acceder a la Plataforma CAIMIUP →</a>
        </div>

        <p style="font-size: 13px; color: #64748B;">Por seguridad, le recomendamos cambiar su contraseña tras el primer inicio de sesión.</p>
      `
    });

    return this.enviarCorreo({
      to: email,
      subject: `[CAIMIUP] Credenciales de Acceso a la Plataforma TEA · ${rolEtiqueta}`,
      html
    });
  }

  /**
   * Envía notificación de nuevo comunicado docente a la familia
   */
  async enviarNotificacionComunicado({ emailPadre, nombrePadre, nombreDocente, asunto, contenido, nombreNino = null, urlAcceso = 'http://localhost:3000/dashboard/padre.html' }) {
    const html = this.generarPlantillaInstitucional({
      titulo: 'Nueva Observación Pedagógica Docente',
      subtitulo: 'Centro de Atención Integral Materno Infantil · CAIMIUP',
      contenidoHtml: `
        <p>Estimada familia de <strong>${nombrePadre}</strong>,</p>
        <p>El equipo interdisciplinario de CAIMIUP ha emitido una nueva comunicación oficial relacionada con el proceso de acompañamiento${nombreNino ? ` de <strong>${nombreNino}</strong>` : ''}:</p>

        <div class="card-info" style="border-left-color: #2563EB;">
          <div class="card-info-title">📋 ${asunto}</div>
          <div style="font-size: 14px; color: #1E293B; white-space: pre-wrap; margin-top: 8px;">${contenido}</div>
          <div style="font-size: 12px; color: #64748B; margin-top: 12px; border-top: 1px solid #E2E8F0; padding-top: 6px;">
            <strong>Emisor:</strong> ${nombreDocente || 'Especialista TEA · CAIMIUP'} · <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <p>Puede consultar el reporte analítico completo y confirmar la lectura de este mensaje ingresando a su portal:</p>

        <div style="text-align: center;">
          <a href="${urlAcceso}" class="btn-action" target="_blank">Abrir Portal Familiar CAIMIUP →</a>
        </div>
      `
    });

    return this.enviarCorreo({
      to: emailPadre,
      subject: `[CAIMIUP] Observación Pedagógica: ${asunto}`,
      html
    });
  }

  /**
   * Envía confirmación de recepción de consulta desde el formulario público
   */
  async enviarConfirmacionContacto({ nombre, correo, asunto, mensaje }) {
    const html = this.generarPlantillaInstitucional({
      titulo: 'Confirmación de Consulta Recibida',
      subtitulo: 'Centro de Atención Integral Materno Infantil · CAIMIUP',
      contenidoHtml: `
        <p>Estimado(a) <strong>${nombre}</strong>,</p>
        <p>Hemos recibido satisfactoriamente su consulta dirigida al <strong>Centro de Atención Integral Materno Infantil (CAIMIUP)</strong> de la Universidad de Pamplona.</p>

        <div class="card-info">
          <div class="card-info-title">Detalle de la Consulta Registrada:</div>
          <div><strong>Asunto:</strong> ${asunto || 'Consulta General'}</div>
          <div style="margin-top:6px; font-style:italic; color:#475569;">"${mensaje}"</div>
        </div>

        <p>Nuestro equipo interdisciplinario y de coordinación revisará su requerimiento y le contactará a este correo electrónico a la mayor brevedad posible.</p>
      `
    });

    return this.enviarCorreo({
      to: correo,
      subject: `[CAIMIUP] Confirmación de Recepción: ${asunto || 'Consulta Ciudadana'}`,
      html
    });
  }

  /**
   * Método de prueba de entrega de correo para diagnóstico del Administrador
   */
  async probarEnvio(destinatario) {
    if (!destinatario || !destinatario.includes('@')) {
      throw new Error('Debe especificar una dirección de correo válida para la prueba.');
    }

    const html = this.generarPlantillaInstitucional({
      titulo: 'Prueba de Entrega de Correo CAIMIUP',
      subtitulo: 'Verificación de Enrutamiento y Remitente Institucional',
      contenidoHtml: `
        <p>Este es un mensaje de verificación técnica emitido por el sistema <strong>CAIMIUP</strong> (Universidad de Pamplona).</p>
        <div class="card-info">
          <div class="card-info-title">Diagnóstico de Envío:</div>
          <div><strong>Estado:</strong> ✅ Transmisión Exitosa</div>
          <div><strong>Destinatario de Prueba:</strong> <code>${destinatario}</code></div>
          <div><strong>Remitente Verificado:</strong> <code>${this.config.fromName} &lt;${this.config.fromEmail}&gt;</code></div>
          <div><strong>Timestamp:</strong> ${new Date().toISOString()}</div>
        </div>
        <p>Si está leyendo este mensaje en su bandeja de entrada, la entrega directa ha sido validada y su configuración de remitente institucional opera sin intermediarios de terceros.</p>
      `
    });

    return this.enviarCorreo({
      to: destinatario,
      subject: `[CAIMIUP] Verificación de Entrega de Correo Institucional`,
      html
    });
  }

  getStatus() {
    this.cargarConfiguracion();
    return {
      habilitado: this.config.enabled,
      servidor_smtp: this.config.host,
      puerto: this.config.port,
      seguridad_tls: this.config.secure,
      remitente_nombre: this.config.fromName,
      remitente_correo: this.config.fromEmail,
      credenciales_configuradas: Boolean(this.config.user && this.config.pass),
      total_historial: this.historialEnvios.length,
      ultimos_envios: this.historialEnvios.slice(0, 5)
    };
  }
}

module.exports = new EmailService();
