document.getElementById("pdfBtn").addEventListener("click", async () => {
    // Definimos el tipo de imagen fijo para asegurar la máxima calidad
    const IMAGE_VERSION_TYPE = "large";

    // ------------------------------------------------------------------
    // LÓGICA: Obtener el nombre del archivo
    // ------------------------------------------------------------------
    const deckNameInput = document.getElementById("deckNameInput");
    const customName = deckNameInput ? deckNameInput.value.trim() : '';

    // Limpia el nombre para evitar caracteres no válidos en el archivo
    const fileName = customName.length > 0
        ? customName.replace(/[^a-z0-9\s-]/gi, '_') + '.pdf'
        : "mtg_deck.pdf";
    // ------------------------------------------------------------------

    // --- Throttling utility para descargas de imágenes ---
    // Máxima concurrencia (10)
    async function throttlePdfFetches(promises, limit = 10) {
        const runningPromises = [];
        for (const promiseFn of promises) {
            const p = promiseFn().then(() => {
                runningPromises.splice(runningPromises.indexOf(p), 1);
            });
            runningPromises.push(p);
            if (runningPromises.length >= limit) {
                await Promise.race(runningPromises);
            }
        }
        return Promise.all(runningPromises);
    }
    // ---------------------------------------------

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const margin = 5;
    const cardW_mm = 63;
    const cardH_mm = 88;
    const spaceX = 4;
    const spaceY = 4;

    const fetchPromises = [];

    // --- Configuración de redondeo de esquinas (Calidad Restaurada) ---
    const cornerRadius_px = 20;
    const cardRenderWidth_px = 500; // Restaurado a 500 para máxima calidad
    const cardRenderHeight_px = (cardRenderWidth_px / cardW_mm) * cardH_mm;
    // ---------------------------------------------


    // 1. PRIMERA PASADA: Identificar y poner en cola las imágenes únicas que faltan por cachear
    for (const card of cardData) {
        const currentID = `${card.currentSet}|${card.currentCN}`;
        const imgObj = card.images[currentID] || Object.values(card.images)[0];
        // Usamos la constante de máxima calidad
        const imgURL = imgObj[IMAGE_VERSION_TYPE] || imgObj.normal;
        const cacheKey = currentID + '|' + IMAGE_VERSION_TYPE; // Usamos la constante de máxima calidad

        if (!card.base64Cache) {
            card.base64Cache = {};
        }

        // Si la imagen ya está en caché, la saltamos.
        if (card.base64Cache[cacheKey]) {
            continue;
        }

        fetchPromises.push(async () => {
            const cardName = card.name;
            try {
                const response = await fetch(imgURL);
                if (!response.ok) {
                    throw new Error(`Error ${response.status} al descargar.`);
                }
                const blob = await response.blob();
                const originalBase64 = await blobToBase64(blob);

                // Redondear las esquinas
                const roundedBase64 = await roundImageCorners(originalBase64, cardRenderWidth_px, cardRenderHeight_px, cornerRadius_px, cardName);
                card.base64Cache[cacheKey] = roundedBase64;

            } catch (e) {
                // Mensaje de error amigable al usuario
                alert(`AVISO: Error al procesar la imagen de la carta "${cardName}". Se saltará esta carta. Detalle: ${e.message}`);
            }
        });
    }

    // 2. Ejecutar todas las descargas únicas con límite de concurrencia (10)
    if (fetchPromises.length > 0) {
        document.getElementById("pdfBtn").innerText = "Preparando imágenes...";
        document.getElementById("pdfBtn").disabled = true;

        await throttlePdfFetches(fetchPromises, 10);

        document.getElementById("pdfBtn").innerText = "Generar PDF";
        document.getElementById("pdfBtn").disabled = false;
    }


    // 3. SEGUNDA PASADA: Generar PDF usando datos Base64 cacheados (INSTANTÁNEO)
    let x_mm = margin;
    let y_mm = margin;

    for (const card of cardData) {
        const currentID = `${card.currentSet}|${card.currentCN}`;
        // Usamos la constante de máxima calidad
        const cacheKey = currentID + '|' + IMAGE_VERSION_TYPE;
        const base64Data = card.base64Cache ? card.base64Cache[cacheKey] : null;

        if (!base64Data) {
            continue;
        }

        for (let i = 0; i < card.qty; i++) {
            pdf.addImage(base64Data, "PNG", x_mm, y_mm, cardW_mm, cardH_mm);

            x_mm += cardW_mm + spaceX;
            if (x_mm + cardW_mm > 210 - margin) {
                x_mm = margin;
                y_mm += cardH_mm + spaceY;
            }

            if (y_mm + cardH_mm > 297 - margin) {
                pdf.addPage();
                x_mm = margin;
                y_mm = margin;
            }
        }
    }

    pdf.save(fileName);
});

// Función auxiliar para convertir Blob a Base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// FUNCIÓN: Redondea las esquinas de una imagen Base64
function roundImageCorners(base64Image, width, height, radius, cardName) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Image;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            ctx.beginPath();
            ctx.moveTo(radius, 0);
            ctx.lineTo(width - radius, 0);
            ctx.quadraticCurveTo(width, 0, width, radius);
            ctx.lineTo(width, height - radius);
            ctx.quadraticCurveTo(width, height, width - radius, height);
            ctx.lineTo(radius, height);
            ctx.quadraticCurveTo(0, height, 0, height - radius);
            ctx.lineTo(0, radius);
            ctx.quadraticCurveTo(0, 0, radius, 0);
            ctx.closePath();
            ctx.clip();

            ctx.drawImage(img, 0, 0, width, height);

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            alert(`AVISO: Error al cargar la imagen de la carta "${cardName}" en el canvas. Se usará la imagen original sin redondear.`);
            resolve(base64Image);
        };
    });
}