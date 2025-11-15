const importUrlBtn = document.getElementById("importUrlBtn");
const deckUrl = document.getElementById("deckUrl");

// Función principal de importación
importUrlBtn.addEventListener("click", async () => {
    const url = deckUrl.value.trim();

    if (!url) {
        alert("Por favor, introduce una URL");
        return;
    }

    importUrlBtn.textContent = "Importando...";
    importUrlBtn.disabled = true;

    try {
        let deckList = "";

        if (url.includes("moxfield.com")) {
            deckList = await importFromMoxfield(url);
        } else if (url.includes("archidekt.com")) {
            deckList = await importFromArchidekt(url);
        } else {
            throw new Error("URL no soportada. Solo Moxfield y Archidekt son compatibles.");
        }

        if (deckList) {
            deckInput.value = deckList;
            alert(`✅ Mazo importado correctamente!\n${deckList.split('\n').length} líneas cargadas.`);

            // Auto-procesar
            if (confirm("¿Quieres procesar las cartas ahora?")) {
                processBtn.click();
            }
        }
    } catch (error) {
        alert(`❌ Error al importar: ${error.message}`);
        console.error(error);
    } finally {
        importUrlBtn.textContent = "Importar desde URL";
        importUrlBtn.disabled = false;
    }
});

// ========================================
// IMPORTAR DESDE MOXFIELD
// ========================================
async function importFromMoxfield(url) {
    // Extraer el ID del mazo de la URL
    // Ejemplo: https://www.moxfield.com/decks/ABC123 -> ABC123
    const deckIdMatch = url.match(/\/decks\/([a-zA-Z0-9_-]+)/);

    if (!deckIdMatch) {
        throw new Error("No se pudo extraer el ID del mazo de Moxfield");
    }

    const deckId = deckIdMatch[1];
    const apiUrl = `https://api2.moxfield.com/v3/decks/all/${deckId}`;

    try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return parseMoxfieldData(data);
    } catch (error) {
        throw new Error(`Error al conectar con Moxfield: ${error.message}`);
    }
}

function parseMoxfieldData(data) {
    const lines = [];

    // Parsear mainboard
    if (data.boards && data.boards.mainboard && data.boards.mainboard.cards) {
        for (const [cardName, cardData] of Object.entries(data.boards.mainboard.cards)) {
            const qty = cardData.quantity || 1;
            const setCode = cardData.card?.set || '';
            const collectorNumber = cardData.card?.cn || '';
            const isFoil = cardData.finish === 'foil' ? ' *F*' : '';

            // Formato: 4x Lightning Bolt (MH3) 122 *F*
            let line = `${qty}x ${cardData.card?.name || cardName}`;

            if (setCode) {
                line += ` (${setCode.toUpperCase()})`;
            }

            if (collectorNumber) {
                line += ` ${collectorNumber}`;
            }

            line += isFoil;
            lines.push(line);
        }
    }

    // Parsear commanders
    if (data.boards && data.boards.commanders && data.boards.commanders.cards) {
        for (const [cardName, cardData] of Object.entries(data.boards.commanders.cards)) {
            const qty = cardData.quantity || 1;
            const setCode = cardData.card?.set || '';
            const collectorNumber = cardData.card?.cn || '';
            const isFoil = cardData.finish === 'foil' ? ' *F*' : '';

            let line = `${qty}x ${cardData.card?.name || cardName}`;

            if (setCode) {
                line += ` (${setCode.toUpperCase()})`;
            }

            if (collectorNumber) {
                line += ` ${collectorNumber}`;
            }

            line += isFoil;
            lines.push(line);
        }
    }

    return lines.join('\n');
}

// ========================================
// IMPORTAR DESDE ARCHIDEKT
// ========================================
async function importFromArchidekt(url) {
    // Extraer el ID del mazo de la URL
    // Ejemplo: https://archidekt.com/decks/123456 -> 123456
    const deckIdMatch = url.match(/\/decks\/(\d+)/);

    if (!deckIdMatch) {
        throw new Error("No se pudo extraer el ID del mazo de Archidekt");
    }

    const deckId = deckIdMatch[1];
    const apiUrl = `https://archidekt.com/api/decks/${deckId}/`;

    try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return parseArchidektData(data);
    } catch (error) {
        throw new Error(`Error al conectar con Archidekt: ${error.message}`);
    }
}

function parseArchidektData(data) {
    const lines = [];

    if (!data.cards || !Array.isArray(data.cards)) {
        throw new Error("Formato de datos de Archidekt inválido");
    }

    for (const cardData of data.cards) {
        const qty = cardData.quantity || 1;
        const cardName = cardData.card?.oracleCard?.name || cardData.card?.name || 'Unknown';
        const setCode = cardData.card?.edition?.editioncode || '';
        const collectorNumber = cardData.card?.collectorNumber || '';
        const isFoil = cardData.modifier === 'Foil' ? ' *F*' : '';

        // Formato: 4x Lightning Bolt (MH3) 122 *F*
        let line = `${qty}x ${cardName}`;

        if (setCode) {
            line += ` (${setCode.toUpperCase()})`;
        }

        if (collectorNumber) {
            line += ` ${collectorNumber}`;
        }

        line += isFoil;
        lines.push(line);
    }

    return lines.join('\n');
}

// ========================================
// FUNCIÓN DE AYUDA: Detectar plataforma
// ========================================
function detectDeckPlatform(url) {
    if (url.includes("moxfield.com")) return "Moxfield";
    if (url.includes("archidekt.com")) return "Archidekt";
    if (url.includes("tappedout.net")) return "TappedOut (no soportado aún)";
    if (url.includes("deckstats.net")) return "Deckstats (no soportado aún)";
    return "Desconocido";
}

// Mostrar ayuda al enfocar el input
deckUrl.addEventListener("focus", () => {
    const helpText = document.createElement("div");
    helpText.id = "urlHelp";
    helpText.className = "text-xs text-gray-500 mt-1";
    helpText.innerHTML = `
        <div>✅ Soportado: Moxfield, Archidekt</div>
        <div>Ejemplo Moxfield: https://www.moxfield.com/decks/ABC123</div>
        <div>Ejemplo Archidekt: https://archidekt.com/decks/123456</div>
    `;

    if (!document.getElementById("urlHelp")) {
        deckUrl.parentElement.appendChild(helpText);
    }
});

deckUrl.addEventListener("blur", () => {
    const helpText = document.getElementById("urlHelp");
    if (helpText) {
        setTimeout(() => helpText.remove(), 200);
    }
});