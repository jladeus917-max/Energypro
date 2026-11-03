 /**
 * EnergyPro - Google Apps Script
 * Guarda el informe en una Hoja de Cálculo y lo envía por correo.
 *
 * INSTRUCCIONES:
 * 1. Crea un proyecto nuevo en https://script.google.com
 * 2. Borra el código que viene por defecto y pega TODO este archivo
 * 3. Cambia las 3 constantes de abajo (SPREADSHEET_ID, SHEET_NAME, EMAIL_DESTINO)
 * 4. Guarda el proyecto
 * 5. Implementar → Nueva implementación → Tipo: Aplicación web
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier persona
 * 6. Copia la URL que termina en /exec y pégala en el HTML (const WEB_APP_URL)
 */

// ====================== CONFIGURACIÓN (CAMBIA ESTOS 3 VALORES) ======================
const SPREADSHEET_ID = "1t71WG1nS1c90Dx26wfaLDI29R0Udch9dMJ1MmN6e8us";  // ID de tu hoja
const SHEET_NAME     = "Hoja 1";                                           // Nombre de la pestaña
const EMAIL_DESTINO  = "juanladeusladeus@gmail.com";                       // Correo donde quieres recibir los informes
// ====================================================================================

function doPost(e) {
  try {
    // Registrar que llegó una petición (útil para depurar)
    console.log("doPost recibido");
    console.log("e.parameter:", JSON.stringify(e.parameter || {}));
    console.log("e.postData:", e.postData ? e.postData.contents : "sin postData");

    let data = null;

    // Formato que envía el HTML (URLSearchParams con "payload")
    if (e.parameter && e.parameter.payload) {
      data = JSON.parse(e.parameter.payload);
    }
    // Formato alternativo (JSON puro)
    else if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    if (!data) {
      throw new Error("No se recibieron datos válidos");
    }

    console.log("Datos parseados OK. Cliente:", data.client ? data.client.name : "sin nombre");

    // 1. Guardar en la hoja
    guardarEnHoja(data);

    // 2. Enviar correo
    enviarCorreo(data);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", message: "Informe guardado y enviado" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error("ERROR en doPost:", error.toString());
    // Intentamos escribir el error también en la hoja para que lo veas
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
      sheet.appendRow([new Date(), "ERROR", error.toString()]);
    } catch (e2) {
      console.error("Tampoco se pudo escribir el error en la hoja:", e2);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function guardarEnHoja(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

  const client  = data.client  || {};
  const summary = data.summary || {};

  const fila = [
    new Date(),                                                      // A - Fecha
    client.reportNumber || "",                                       // B - N° Informe
    client.name || "",                                               // C - Cliente
    client.nit || "",                                                // D - NIT
    client.address || "",                                            // E - Dirección
    client.phone || "",                                              // F - Teléfono
    client.email || "",                                              // G - Email
    client.auditor || "",                                            // H - Auditor
    data.projectType || "",                                          // I - Tipo Proyecto
    summary.monthlyKwh != null ? Number(summary.monthlyKwh).toFixed(2) : "",  // J - Consumo Mensual
    summary.monthlyCost != null ? Math.round(Number(summary.monthlyCost)) : "" // K - Costo Mensual
  ];

  sheet.appendRow(fila);
  console.log("Fila agregada correctamente en la hoja");
}

function enviarCorreo(data) {
  const client    = data.client    || {};
  const summary   = data.summary   || {};
  const inventory = data.inventory || [];
  const savings   = summary.savings || {};

  let cuerpo = 
`═══════════════════════════════════════════
 INFORME DE AUDITORÍA ENERGÉTICA
EnergyPro - ${new Date().toLocaleDateString('es-CO')}
═══════════════════════════════════════════

📋 DATOS DEL CLIENTE
• Nombre: ${client.name || 'N/A'}
• NIT: ${client.nit || 'N/A'}
• Dirección: ${client.address || 'N/A'}
• Teléfono: ${client.phone || 'N/A'}
• Email: ${client.email || 'N/A'}
• Auditor: ${client.auditor || 'N/A'}
• Fecha: ${client.date || 'N/A'}
• N° Informe: ${client.reportNumber || 'N/A'}

🏗️ TIPO DE PROYECTO: ${data.projectType || 'N/A'}

📊 RESUMEN ENERGÉTICO
• Total de equipos: ${summary.equipmentCount || 0}
• Consumo diario: ${Number(summary.dailyKwh || 0).toFixed(2)} kWh
• Consumo mensual: ${Number(summary.monthlyKwh || 0).toFixed(2)} kWh
• Costo mensual estimado: $${Math.round(Number(summary.monthlyCost || 0)).toLocaleString('es-CO')} COP
• Potencia instalada: ${Number(summary.installedKw || 0).toFixed(2)} kW
• Demanda estimada: ${Number(summary.estimatedDemandKw || 0).toFixed(2)} kW

💰 TARIFA: $${Number(data.tariff || 0).toLocaleString('es-CO')} COP/kWh

📉 ANÁLISIS DE AHORRO
• Ahorro mensual estimado: $${Math.round(Number(savings.money || 0)).toLocaleString('es-CO')} COP
• Energía ahorrada: ${Number(savings.kwh || 0).toFixed(1)} kWh/mes
• Reducción CO2: ${Number(savings.co2 || 0).toFixed(1)} kg/mes

📋 INVENTARIO DE EQUIPOS
`;

  inventory.forEach(function(eq, i) {
    const qty = eq.quantity || eq.qty || 1;
    cuerpo += `${i + 1}. ${eq.name} (${eq.category || eq.cat || ''})
   • Potencia: ${Math.round(eq.powerW || 0)} W
   • Uso: ${eq.hours} h/día × ${eq.days} días/mes
   • Cantidad: ${qty}
   • Consumo diario: ${((eq.dailyKwh || 0) * qty).toFixed(2)} kWh
   • Consumo mensual: ${((eq.monthlyKwh || 0) * qty).toFixed(1)} kWh

`;
  });

  if (client.notes) {
    cuerpo += `\n📝 OBSERVACIONES:\n${client.notes}\n`;
  }

  cuerpo += `
═══════════════════════════════════════════
Generado automáticamente por EnergyPro
═══════════════════════════════════════════
`;

  const asunto = `Informe EnergyPro - ${client.name || 'Cliente'} - ${client.reportNumber || new Date().toLocaleDateString('es-CO')}`;

  // Enviar a tu correo
  MailApp.sendEmail({
    to: EMAIL_DESTINO,
    subject: asunto,
    body: cuerpo
  });

  // También al cliente si puso email
  if (client.email && client.email.indexOf("@") !== -1) {
    MailApp.sendEmail({
      to: client.email,
      subject: asunto,
      body: cuerpo
    });
  }

  console.log("Correo enviado a", EMAIL_DESTINO);
}

/**
 * Función de prueba manual (ejecútala desde el editor de Apps Script)
 * para verificar que la hoja y el correo funcionan.
 */
function testManual() {
  const datosPrueba = {
    type: "energypro_audit_report",
    client: {
      name: "Empresa de Prueba S.A.S",
      nit: "900.123.456-7",
      address: "Calle 100 # 50-20",
      phone: "3122161986",
      email: "juanladeusladeus@gmail.com",
      auditor: "Ing. Juan",
      date: "2026-11-03",
      reportNumber: "AUD-2026-TEST"
    },
    projectType: "commerce",
    tariff: 850,
    summary: {
      equipmentCount: 2,
      dailyKwh: 12.5,
      monthlyKwh: 375,
      monthlyCost: 318750,
      installedKw: 3.2,
      estimatedDemandKw: 2.1,
      savings: { kwh: 37.5, money: 31875, co2: 15 }
    },
    inventory: [
      { name: "Aire Acondicionado", category: "Climatización", powerW: 1200, hours: 8, days: 30, quantity: 1, dailyKwh: 9.6, monthlyKwh: 288 },
      { name: "Nevera", category: "Electrodomésticos", powerW: 150, hours: 24, days: 30, quantity: 1, dailyKwh: 3.6, monthlyKwh: 108 }
    ]
  };

  guardarEnHoja(datosPrueba);
  enviarCorreo(datosPrueba);
  Logger.log("Prueba manual terminada. Revisa la hoja y el correo.");
}
