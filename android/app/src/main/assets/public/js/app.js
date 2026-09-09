console.log("Iniciando app local MAR Caribe...");

document.addEventListener("DOMContentLoaded", () => {
    const yoloSlider = document.getElementById("yoloConf");
    const yoloVal = document.getElementById("yoloConfVal");
    const ocrSlider = document.getElementById("ocrThresh");
    const ocrVal = document.getElementById("ocrThreshVal");
    const btnExportLog = document.getElementById("btnExportLog");

    yoloSlider.addEventListener("input", (e) => {
        yoloVal.textContent = e.target.value;
    });

    ocrSlider.addEventListener("input", (e) => {
        ocrVal.textContent = e.target.value;
    });

    btnExportLog.addEventListener("click", () => {
        const logContent = `--- LOG ESTÁNDAR DE INFERENCIA ---\nFecha: ${new Date().toISOString()}\nYOLOv11 Conf: ${yoloSlider.value}\nPaddleOCR Thresh: ${ocrSlider.value}\nEstado: Operando localmente sin internet.\n`;
        const blob = new Blob([logContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `inference_log_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });
});
