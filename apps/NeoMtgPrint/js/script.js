const processBtn = document.getElementById("processBtn");
const deckInput = document.getElementById("deckInput");
const cardsContainer = document.getElementById("cardsContainer");
const pdfSection = document = document.getElementById("pdfSection");

let cardData = [];
let selectedVersionType = "normal"; // Declaración Global necesaria para pdf.js

// ==============================
// FUNCIÓN DE THROTTLING Y RATE LIMITING (CLAVE)
// ==============================
// Limita la cantidad de promesas concurrentes (limit) y añade un delay (delayMs) entre el inicio de cada una.
async function throttlePromises(promises, limit = 5, delayMs = 60) { // AJUSTADO a 60ms
    const results = [];
    const runningPromises = [];

    for (const promiseFn of promises) {

        // 1. Rate Limiting: Esperar 60ms antes de iniciar la siguiente petición
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // 2. Concurrency Control: Crear la promesa y añadir lógica de finalización
        const p = promiseFn.then(result => {
            // Eliminar de la lista cuando termina
            runningPromises.splice(runningPromises.indexOf(p), 1);
            return result;
        });

        runningPromises.push(p);
        results.push(p);

        // Si alcanzamos el límite de concurrencia, esperamos a que una termine
        if (runningPromises.length >= limit) {
            await Promise.race(runningPromises);
        }
    }

    // Esperar a que terminen las promesas restantes
    return Promise.all(results);
}


// ==============================
// BOTÓN “Mostrar”
// ==============================
processBtn.addEventListener("click", async () => {
    const text = deckInput.value.trim();
    if (!text) return;

    const lines = text.split("\n");
    cardData = [];

    cardsContainer.innerHTML = "Cargando cartas...";

    // ----------------------------------------------------
    // OPTIMIZACIÓN: Crear promesas pero no ejecutarlas todavía
    // ----------------------------------------------------
    const cardPromises = lines.map(line => {
        // ... (Lógica de parsing) ...
        const qtyMatch = line.match(/^(\d+)x?\s*(.+)$/i);
        if (!qtyMatch) return null;

        const qty = parseInt(qtyMatch[1]);
        let fullLine = qtyMatch[2].trim();

        const setMatch = fullLine.match(/\(([^)]+)\)/);
        const userSetCode = setMatch ? setMatch[1].toLowerCase() : null;

        const cnPattern = /(\d+[a-zA-Z]*)\s*(\*F\*)?$/i;
        const cnMatch = fullLine.match(cnPattern);

        const userCollectorNumber = cnMatch ? cnMatch[1].trim() : null;

        let cardName = fullLine;

        if (setMatch) {
            cardName = cardName.replace(setMatch[0], '').trim();
        }

        if (cnMatch) {
            cardName = cardName.replace(cnMatch[0], '').trim();
        }

        cardName = cardName.replace(/\s*[A-Z]{3,4}-?\d+[a-zA-Z*]*\s*$/i, '').trim();
        cardName = cardName.replace(/\s*\*F\*\s*$/i, '').trim();

        cardName = cleanCardName(cardName);

        if (!cardName) return null;

        // Devolvemos la Promesa de fetchCard
        return fetchCard(cardName, userSetCode, userCollectorNumber).then(data => {
            if (data) {
                data.qty = qty;

                // Si el usuario especificó Set/CN y la búsqueda fue exitosa, usamos eso.
                // Sino, usamos el valor por defecto de la carta encontrada.
                if (userSetCode && userCollectorNumber && data.initialFetchSuccess) {
                    data.currentSet = userSetCode;
                    data.currentCN = userCollectorNumber;
                } else {
                    data.currentSet = data.cardDetails.set;
                    data.currentCN = data.cardDetails.collector_number;
                }

                return data;
            }
            return null;
        });
    }).filter(promise => promise !== null);

    // ----------------------------------------------------
    // EJECUCIÓN CON THROTTLING (5 concurrentes, 60ms delay)
    // ----------------------------------------------------
    const results = await throttlePromises(cardPromises, 5, 60);
    cardData = results.filter(data => data !== null);

    renderCards();
    pdfSection.classList.remove("hidden");
});

// ==============================
// LIMPIAR NOMBRE DE CARTA
// ==============================
function cleanCardName(line) {
    return line
        .replace(/\[.*?\]/g, "")
        .trim();
}

// ==============================
// BUSCAR CARTA EN SCRYFALL (OPTIMIZADA)
// ==============================
async function fetchCard(name, setCode = null, collectorNumber = null) {
    let data = null;
    let initialFetchSuccess = false;
    let allPrints = [];

    // 1. Búsqueda exacta por set y collector number (MÉTODO PREFERIDO)
    if (setCode && collectorNumber) {
        const url = `https://api.scryfall.com/cards/${setCode}/${collectorNumber}`;
        const res = await fetch(url);

        if (res.status === 200) {
            data = await res.json();
            initialFetchSuccess = true;
        }
    }

    // 2. Búsqueda por nombre o fallback (OPTIMIZADA)
    if (!data) {
        let url = `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(name)}"&unique=prints&order=released`;

        if (setCode) {
            url += `&set=${setCode}`;
        }

        const res = await fetch(url);

        if (res.status === 200) {
            const searchJson = await res.json();

            if (searchJson.data && searchJson.data.length > 0) {
                data = searchJson.data[0];
                allPrints = searchJson.data;
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    // 3. Si la búsqueda Set/CN fue exitosa, necesitamos la lista de todas las impresiones. 
    if (data && allPrints.length === 0) {
        const oracleId = data.oracle_id;
        const allSetsUrl = `https://api.scryfall.com/cards/search?q=oracleid:${oracleId}&unique=prints&order=released`;
        const allSetsRes = await fetch(allSetsUrl);
        const allSetsJson = await allSetsRes.json();

        allPrints = allSetsJson.data && allSetsJson.data.length > 0 ? allSetsJson.data : [data];
    }

    if (!data) return null;


    const processedData = processScryfallData(allPrints, data);
    processedData.initialFetchSuccess = initialFetchSuccess;
    return processedData;
}

// ==============================
// FUNCIÓN AUXILIAR PARA PROCESAR RESPUESTA 
// ==============================
function processScryfallData(allPrints, defaultCardData) {
    const images = {};
    const sets = [];

    const defaultSet = defaultCardData.set;
    const defaultCN = defaultCardData.collector_number;
    const defaultID = `${defaultSet}|${defaultCN}`;

    const initialImgObj = defaultCardData.image_uris || (defaultCardData.card_faces ? defaultCardData.card_faces[0].image_uris : null);
    if (initialImgObj) {
        images[defaultID] = initialImgObj;
    }

    allPrints.forEach(card => {
        const uniqueID = `${card.set}|${card.collector_number}`;

        const label = `${card.set_name} (${card.set})` + (card.collector_number ? ` — ${card.collector_number}` : "");
        sets.push({
            id: uniqueID,
            code: card.set,
            label,
            collector_number: card.collector_number,
            printed_name: card.printed_name || card.name
        });
    });

    sets.sort((a, b) => a.label.localeCompare(b.label));

    return {
        name: defaultCardData.printed_name || defaultCardData.name,
        cardDetails: defaultCardData,
        images,
        sets,
        currentSet: defaultSet,
        currentCN: defaultCN
    };
}

// ==============================
// FUNCIÓN DE CARGA BAJO DEMANDA DE IMAGEN (CLAVE para el cambio de imagen)
// ==============================
async function fetchAndUpdateCardImage(index, newId) {
    const [newSetCode, newCn] = newId.split('|');

    const card = cardData[index];
    const cardElement = cardsContainer.querySelector(`[data-card-index="${index}"]`);
    const selectElement = cardElement.querySelector('select[data-type="set"]');

    if (card.images[newId]) {
        card.currentSet = newSetCode;
        card.currentCN = newCn;
        updateCardImage(cardElement, card);
        return;
    }

    let url = '';

    if (newCn) {
        url = `https://api.scryfall.com/cards/${newSetCode}/${newCn}`;
    } else {
        const newSetData = card.sets.find(s => s.id === newId);
        const cardSearchName = newSetData?.printed_name || card.cardDetails.name;
        url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardSearchName)}&set=${newSetCode}`;
    }

    selectElement.disabled = true;
    selectElement.classList.add('animate-pulse');

    const res = await fetch(url);

    selectElement.disabled = false;
    selectElement.classList.remove('animate-pulse');

    if (res.status === 200) {
        const data = await res.json();
        const imgObj = data.image_uris || (data.card_faces ? data.card_faces[0].image_uris : null);

        if (imgObj) {
            card.images[newId] = imgObj;
            card.currentSet = newSetCode;
            card.currentCN = newCn;
            updateCardImage(cardElement, card);
        } else {
            alert(`La carta ${newSetCode} - ${newCn} no tiene una imagen válida.`);
        }
    } else {
        alert(`Error al buscar la imagen para el set ${newSetCode}. Código: ${res.status}.`);
    }
}


// ==============================
// FUNCIÓN PARA ACTUALIZAR SÓLO UNA IMAGEN
// ==============================
function updateCardImage(cardElement, c) {
    const currentID = `${c.currentSet}|${c.currentCN}`;
    const imgObj = c.images[currentID];

    const imgSrc = imgObj?.[selectedVersionType] || imgObj?.normal || Object.values(c.images)[0]?.normal || "";

    const imgElement = cardElement.querySelector("img");
    imgElement.src = imgSrc;

    imgElement.onclick = () => openModal(imgSrc);
}


// ==============================
// RENDERIZAR CARTAS
// ==============================
function renderCards() {
    cardsContainer.innerHTML = "";

    cardData.forEach((c, index) => {
        const card = document.createElement("div");
        card.className =
            "p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition cursor-pointer";
        card.setAttribute('data-card-index', index);

        const defaultID = `${c.currentSet}|${c.currentCN}`;
        const imgObj = c.images[defaultID] || Object.values(c.images)[0];
        const imgSrc = imgObj?.[selectedVersionType] || imgObj?.normal || "";

        card.innerHTML = `
            <img src="${imgSrc}" class="w-full rounded-xl mb-2 shadow">
            <h3 class="font-bold text-lg mb-2">${c.name}</h3>

            <label class="block text-sm mb-1">Set:</label>
            <select class="w-full mb-2 p-1 bg-gray-200 dark:bg-gray-700 rounded-xl" data-index="${index}" data-type="set">
                ${c.sets.map(s => `<option value="${s.id}" ${s.id === defaultID ? "selected" : ""}>${s.label}</option>`).join("")}
            </select>
            
            <label class="block text-sm mb-1">Cantidad:</label>
            <input type="number" value="${c.qty}" min="1" class="w-20 p-1 bg-gray-200 dark:bg-gray-700 rounded-xl" data-index="${index}" data-type="qty">
        `;

        card.querySelector("img").addEventListener("click", () => openModal(imgSrc));

        cardsContainer.appendChild(card);
    });

    // ==============================
    // MANEJO DE CAMBIOS (DELEGACIÓN)
    // ==============================
    cardsContainer.querySelectorAll('select[data-type="set"]').forEach(sel => {
        sel.addEventListener("change", e => {
            const i = e.target.getAttribute("data-index");
            fetchAndUpdateCardImage(i, e.target.value);
        });
    });

    cardsContainer.querySelectorAll("input").forEach(input => {
        input.addEventListener("change", e => {
            const i = e.target.getAttribute("data-index");
            cardData[i].qty = parseInt(e.target.value);
        });
    });
}

// ==============================
// MODAL PARA VER IMAGEN GRANDE
// ==============================
const modal = document.getElementById("modal");
const modalOverlay = document.getElementById("modalOverlay");
const modalImg = document.getElementById("modalImg");

function openModal(src) {
    modalImg.src = src;
    modal.classList.remove("hidden");
    modalOverlay.classList.remove("hidden");
    modalOverlay.onclick = closeModal;
}

function closeModal() {
    modal.classList.add("hidden");
    modalOverlay.classList.add("hidden");
}