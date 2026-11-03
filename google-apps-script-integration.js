/* EnergyPro → Google Apps Script report integration.
 * Include this file after the existing inline application script in index.html.
 * The Apps Script doPost(e) handler should read JSON.parse(e.parameter.payload).
 */
(() => {
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxgahZKJS1-ZvtueCeqJxUyMyN1OGHopBzDI6uI6eLZqzTkFBrxXcKV2NdWTMzwqa4/exec";
  const originalGenerateReport = window.generateReport;

  if (typeof originalGenerateReport !== "function") {
    console.error("EnergyPro report function was not found; load this script after the application script.");
    return;
  }

  window.generateReport = function (...args) {
    const result = originalGenerateReport.apply(this, args);

    // The existing report flow requires at least one equipment entry.
    if (!Array.isArray(state.inventory) || state.inventory.length === 0) return result;

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
      inventory: state.inventory.map(({ id, name, cat, method, powerW, knownKwh, hours, days, qty, voltage, phases, pf, dailyKwh, monthlyKwh, individualSavePct }) => ({
        id, name, category: cat, method, powerW, knownKwh, hours, days, quantity: qty,
        voltage, phases, powerFactor: pf, dailyKwh, monthlyKwh, individualSavingsPct: individualSavePct
      }))
    };

    // URL-encoded POST avoids a cross-origin JSON preflight. Apps Script must
    // accept a form parameter named "payload" and parse it as JSON.
    const body = new URLSearchParams({ payload: JSON.stringify(payload) });
    fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body
    }).then(() => {
      showToast("📤 Informe enviado a Google Apps Script", "success");
    }).catch((error) => {
      console.error("No se pudo enviar el informe a Google Apps Script:", error);
      showToast("⚠️ No se pudo enviar el informe", "error");
    });

    return result;
  };
})();
