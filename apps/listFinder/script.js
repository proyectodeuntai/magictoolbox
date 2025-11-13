const STORAGE_KEY = "magic_card_matcher_db_v1";
const idInput = document.getElementById("identifier");
const uploadFile = document.getElementById("uploadFile");
const saveBtn = document.getElementById("saveBtn");
const message = document.getElementById("message");
const userListsDiv = document.getElementById("userLists");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const myList = document.getElementById("myList");
const myFile = document.getElementById("myFile");
const matchBtn = document.getElementById("matchBtn");
const searchCard = document.getElementById("searchCard");
const searchBtn = document.getElementById("searchBtn");
const resultsDiv = document.getElementById("results");

let db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    renderDB();
}

// Función mejorada para parsear CSV respetando las columnas
function parseCSV(text) {
    if (!text) return [];

    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];

    // Detectar si la primera línea es un header CSV
    const firstLine = lines[0].toLowerCase();
    const isCSV = firstLine.includes('name') && firstLine.includes('set');

    if (isCSV && lines.length > 1) {
        // Es un CSV con headers - parseamos la estructura
        const headers = parseCSVLine(lines[0]);
        const cards = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === 0) continue;

            const card = {};
            headers.forEach((header, index) => {
                card[header] = values[index] || '';
            });

            // Solo añadir si tiene nombre
            if (card.Name && card.Name.trim()) {
                cards.push(card);
            }
        }

        return cards;
    } else {
        // Es una lista simple de nombres
        return lines.map(line => {
            const trimmed = line.trim();
            return trimmed ? { Name: trimmed } : null;
        }).filter(Boolean);
    }
}

// Parser simple de líneas CSV que respeta comillas
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

// Función para parsear listas simples de texto
function parseTextToCards(text) {
    if (!text) return [];
    return text
        .split(/\r?\n|;/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map(name => ({ Name: name }));
}

function renderDB() {
    userListsDiv.innerHTML = "";
    const keys = Object.keys(db);
    if (keys.length === 0) {
        userListsDiv.innerHTML = `<p class='text-gray-500 text-sm'>No lists saved yet.</p>`;
        return;
    }
    for (const id of keys) {
        const cards = db[id];
        const div = document.createElement("div");
        div.className =
            "p-4 border rounded-xl bg-white dark:bg-gray-800 shadow-sm flex flex-col";

        // Contar cartas únicas por nombre (filtrar las que no tienen Name)
        const validCards = cards.filter(c => c && c.Name);
        const uniqueCards = new Set(validCards.map(c => c.Name.toLowerCase()));

        div.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <div class="font-semibold">${id}</div>
          <div class="text-xs text-gray-500">${validCards.length} total cards (${uniqueCards.size} unique)</div>
        </div>
        <div class="flex gap-2">
          <button class="copyBtn px-2 py-1 text-xs border rounded">Copy Names</button>
          <button class="deleteBtn px-2 py-1 text-xs border rounded">Delete</button>
        </div>
      </div>
      <details class="text-xs mt-1">
        <summary class="cursor-pointer">Show cards</summary>
        <div class="mt-2 max-h-48 overflow-y-auto">
          ${validCards.map(card => {
            const parts = [];
            parts.push(card.Name || 'Unknown');
            if (card['Set name']) parts.push(`[${card['Set name']}]`);
            if (card.Foil === 'foil') parts.push('⭐');
            if (card.Quantity && card.Quantity !== '1') parts.push(`x${card.Quantity}`);
            return `<div class="py-0.5">${parts.join(' ')}</div>`;
        }).join('')}
        </div>
      </details>
    `;
        div.querySelector(".copyBtn").onclick = () => {
            const names = validCards.map(c => c.Name).join("\n");
            navigator.clipboard.writeText(names);
            message.textContent = `Copied ${id}'s card names to clipboard`;
        };
        div.querySelector(".deleteBtn").onclick = () => {
            delete db[id];
            saveDB();
        };
        userListsDiv.appendChild(div);
    }
}

saveBtn.onclick = () => {
    const id = idInput.value.trim();
    if (!id || !uploadFile.files[0]) {
        message.textContent = "Enter an identifier and select a file.";
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const cards = parseCSV(e.target.result);
        db[id] = cards;
        saveDB();
        idInput.value = "";
        uploadFile.value = "";
        message.textContent = `Saved ${id} (${cards.length} cards).`;
    };
    reader.readAsText(uploadFile.files[0]);
};

exportBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "magic_card_db.json";
    a.click();
    URL.revokeObjectURL(url);
};

importFile.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            db = data;
            saveDB();
            message.textContent = "Database imported successfully.";
        } catch (err) {
            message.textContent = "Invalid JSON file.";
        }
    };
    reader.readAsText(file);
};

function findMatches(myCards) {
    const matches = {};

    for (const [id, userCards] of Object.entries(db)) {
        const userMatches = [];

        // Para cada carta que busco
        for (const myCard of myCards) {
            if (!myCard || !myCard.Name) continue;
            const myName = myCard.Name.toLowerCase();

            // Buscar en las cartas del usuario (filtrar cartas válidas)
            const foundCards = userCards.filter(c =>
                c && c.Name && c.Name.toLowerCase() === myName
            );

            if (foundCards.length > 0) {
                userMatches.push({
                    searchName: myCard.Name,
                    cards: foundCards
                });
            }
        }

        if (userMatches.length > 0) {
            matches[id] = userMatches;
        }
    }

    return matches;
}

matchBtn.onclick = () => {
    const process = (cards) => {
        const matches = findMatches(cards);
        displayResults(cards, matches);
    };
    if (myFile.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const cards = text.includes(',') && text.toLowerCase().includes('name')
                ? parseCSV(text)
                : parseTextToCards(text);
            process(cards);
        };
        reader.readAsText(myFile.files[0]);
    } else {
        process(parseTextToCards(myList.value));
    }
};

searchBtn.onclick = () => {
    const query = searchCard.value.trim();
    if (!query) return;

    const searchCards = [{ Name: query }];
    const matches = findMatches(searchCards);
    displayResults(searchCards, matches);
};

function displayResults(myCards, matches) {
    resultsDiv.innerHTML = "";

    const myDiv = document.createElement("div");
    myDiv.innerHTML = `<div class="mb-3">
    <div class="font-semibold">Your search (${myCards.length} cards):</div>
    <pre class="text-xs text-gray-700 dark:text-gray-300">${myCards.map(c => c.Name).join("\n")}</pre>
  </div>`;
    resultsDiv.appendChild(myDiv);

    const keys = Object.keys(matches);
    if (keys.length === 0) {
        resultsDiv.innerHTML += `<p class="text-gray-500">No matches found.</p>`;
        return;
    }

    for (const [id, userMatches] of Object.entries(matches)) {
        const div = document.createElement("div");
        div.className = "p-4 border rounded-lg bg-white dark:bg-gray-800 space-y-3";

        let content = `
            <div class="flex justify-between items-start mb-2">
                <div class="font-semibold text-lg">${id}</div>
                <button class="px-3 py-1 text-xs border rounded copyMatches hover:bg-gray-100 dark:hover:bg-gray-700">
                    Copy All
                </button>
            </div>
        `;

        // Agrupar por nombre de carta
        for (const match of userMatches) {
            const totalQty = match.cards.reduce((sum, c) => sum + parseInt(c.Quantity || 1), 0);

            content += `
                <div class="border-l-2 border-blue-500 pl-3">
                    <div class="font-medium text-sm mb-1">${match.searchName} <span class="text-gray-500">(${totalQty} total)</span></div>
                    <div class="space-y-1">
            `;

            for (const card of match.cards) {
                const details = [];
                if (card['Set name']) details.push(card['Set name']);
                if (card['Set code']) details.push(`(${card['Set code']})`);
                if (card['Collector number']) details.push(`#${card['Collector number']}`);

                const badges = [];
                if (card.Foil === 'foil') badges.push('<span class="text-yellow-500">⭐ Foil</span>');
                if (card.Quantity && card.Quantity !== '1') badges.push(`<span class="font-semibold">x${card.Quantity}</span>`);
                if (card.Rarity) badges.push(`<span class="text-purple-600 dark:text-purple-400">${card.Rarity}</span>`);
                if (card.Language && card.Language !== 'en') badges.push(`<span class="text-blue-600">${card.Language.toUpperCase()}</span>`);

                content += `
                    <div class="text-xs text-gray-600 dark:text-gray-400">
                        ${details.join(' ')}
                        ${badges.length > 0 ? `<span class="ml-2">${badges.join(' ')}</span>` : ''}
                    </div>
                `;
            }

            content += `
                    </div>
                </div>
            `;
        }

        div.innerHTML = content;

        div.querySelector(".copyMatches").onclick = () => {
            const allCards = userMatches.flatMap(m => m.cards.map(c => c.Name));
            navigator.clipboard.writeText(allCards.join("\n"));
            message.textContent = `Copied ${allCards.length} matches for ${id}`;
        };

        resultsDiv.appendChild(div);
    }
}

// Theme toggle functionality
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        html.classList.toggle('dark');
        localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
    });
}

renderDB();