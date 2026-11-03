 /* EnergyPro → Google Apps Script (Hoja + Correo) */
(() => {
  // URL de tu Apps Script
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyceXmVEXgbJf5upjSxVWcUm8sGuc_CnbtPM-vnyHROdsIj1wl6QFyQqYhCUJ_A5af1rA/exec";

  const originalGenerateReport = window.generateReport;

  if (typeof originalGenerateReport !== "function") {
    console.error("No se encontró generateReport. Carga este script después del principal.");
    return;
  }

  window.generateReport = function (...args) {
    // Primero ejecuta el comportamiento original (copiar/descargar)
    const result = originalGenerateReport.apply(this, args);

    if (!Array.isArray(state.inventory) || state.inventory.length === 0) {
      return result;
    }

    const payload = {
      type: "energypro_audit_report",
      sentAt: new Date().toISOString(),
      client: { ...state.clientData },
      projectType: state.projectType,
      tariff: Number(state.config.tarifa) || 0,
      summary: {
        equipmentCount: state.inventory.length,
        dailyKwh: getDailyTotal(),
        monthlyKwh: getMonthlyTotal(),
        monthlyCost: getMonthlyTotal() * (Number(state.config.tarifa) || 0),
        installedKw: getInstalledPower() / 1000,
        estimatedDemandKw: calculateDemand() / 1000,
        savings: calculateTotalSavings()
      },
      inventory: state.inventory.map(eq => ({
        id: eq.id,
        name: eq.name,
        category: eq.cat,
        method: eq.method,
        powerW: eq.powerW,
        knownKwh: eq.knownKwh,
        hours: eq.hours,
        days: eq.days,
        quantity: eq.qty,
        voltage: eq.voltage,
        phases: eq.phases,
        powerFactor: eq.pf,
        dailyKwh: eq.dailyKwh,
        monthlyKwh: eq.monthlyKwh,
        individualSavingsPct: eq.individualSavePct
      }))
    };

    // Envío compatible con Apps Script
    const body = new URLSearchParams({ payload: JSON.stringify(payload) });

    fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body
    }).then(() => {
      showToast("📤 Informe enviado a Google Sheets + correo", "success");
    }).catch((error) => {
      console.error("Error al enviar informe:", error);
      showToast("⚠️ No se pudo enviar el informe", "error");
    });

    return result;
  };
})();
