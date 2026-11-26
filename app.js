'use strict';

// All readings and watering actions are simulated locally.
const $ = (id) => document.getElementById(id);
const state = {
    connected: true,
    auto: true,
    moisture: 62,
    light: 720,
    temperature: 26,
    sips: 0,
    notes: [],
    watering: false,
    lastWatered: null,
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches
};
let toastTimer;
let loveTimer;
let connectionTimer;
let wateringOperation = 0;
let loving = false;

try {
    const saved = JSON.parse(localStorage.getItem('vivi-preferences') || '{}');
    if (typeof saved.auto === 'boolean') state.auto = saved.auto;
    if (typeof saved.reduced === 'boolean') state.reduced = saved.reduced;
} catch {
    // The tracker also works when browser storage is unavailable.
}

function savePreferences() {
    try {
        localStorage.setItem('vivi-preferences', JSON.stringify({
            auto: state.auto,
            reduced: state.reduced
        }));
    } catch { /* Private browsing may disable storage. */ }
}

function notify(title, description, icon = '', showToast = true) {
    state.notes.unshift({ title, description, icon, date: new Date() });
    state.notes = state.notes.slice(0, 30);
    renderNotes();
    if (showToast) {
        $('toast').textContent = `${title} — ${description}`;
        $('toast').classList.add('visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4500);
    }
}

function renderNotes() {
    $('notifications').replaceChildren();
    state.notes.forEach((note) => {
        const item = document.createElement('li');
        const icon = document.createElement('span');
        icon.className = 'note-icon';
        icon.textContent = ''; // Text-only notifications; no emoji.
        icon.setAttribute('aria-hidden', 'true');
        const content = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'note-title';
        title.textContent = note.title;
        const description = document.createElement('p');
        description.className = 'note-description';
        description.textContent = note.description;
        const time = document.createElement('time');
        time.dateTime = note.date.toISOString();
        time.textContent = note.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        content.append(title, description, time);
        item.append(icon, content);
        $('notifications').append(item);
    });
    $('noteCount').textContent = state.notes.length;
    $('emptyNotes').hidden = true;
    $('notificationPanel').hidden = state.notes.length === 0;
}

function render() {
    $('topLight').textContent = `${Math.round(state.light)} lux`;
    $('topWater').textContent = `${Math.round(state.moisture)}%`;
    $('topTemp').textContent = state.temperature.toFixed(1);
    $('topFill').style.width = `${Math.min(100, state.light / 12)}%`;
    $('topWaterFill').style.width = `${state.moisture}%`;
    $('sensorButton').setAttribute('aria-label', `Sunlight: ${Math.round(state.light)} lux. Open sensor details.`);
    $('waterTrackerButton').setAttribute('aria-label', `Soil water: ${Math.round(state.moisture)} percent. Open watering details.`);
    $('careButton').setAttribute('aria-label', `Temperature: ${state.temperature.toFixed(1)} degrees Celsius. Open temperature details.`);
    $('lightValue').textContent = Math.round(state.light);
    $('moistureValue').textContent = Math.round(state.moisture);
    $('tempValue').textContent = state.temperature.toFixed(1);
    $('lightBar').style.width = `${Math.min(100, state.light / 12)}%`;
    $('moistureBar').style.width = `${state.moisture}%`;
    $('tempBar').style.width = `${state.temperature / 40 * 100}%`;
    $('moistureTag').textContent = state.moisture < 40 ? 'Getting thirsty' : state.moisture > 75 ? 'Very hydrated' : 'Nicely hydrated';
    $('lightTag').textContent = state.light < 400 ? 'A little dim' : state.light > 1000 ? 'Too bright' : 'Just right';
    $('tempTag').textContent = state.temperature < 18 ? 'Chilly' : state.temperature > 30 ? 'Too warm' : 'Cozy';
    $('connectionText').textContent = state.connected ? 'Connected' : 'Disconnected';
    document.querySelectorAll('.status-dot').forEach((dot) => {
        dot.style.background = state.connected ? '#578443' : '#a67840';
    });
    $('toggleConnection').textContent = state.connected ? 'Disconnect' : 'Connect again';
    $('updateText').textContent = state.connected ? 'Simulated sensors · updates every 8s' : 'Sensors paused · showing last readings';
    $('autoWater').checked = state.auto;
    $('autoLabel').textContent = state.auto ? ' Auto-watering is on' : ' Auto-watering is off';
    $('waterCount').textContent = `${state.sips} / ${state.sips * 50} mL`;
    $('lastWatered').textContent = state.lastWatered ? state.lastWatered.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not yet';
    $('waterNow').disabled = !state.connected || state.watering || state.moisture >= 80;
    $('waterButton').setAttribute('aria-busy', String(state.watering));
    $('waterButton').setAttribute('aria-disabled', String(!state.connected || state.watering || state.moisture >= 80));
    $('waterButton').setAttribute('aria-label', state.watering ? 'Watering in progress' : state.moisture >= 80 ? 'Vivi is hydrated. No water needed.' : 'Water Vivi');
    $('waterNow').textContent = state.watering ? 'A little sip in progress…' : state.moisture >= 80 ? 'Hydrated — no water needed' : 'Give Vivi a drink ';
    if (!loving) {
        $('screenMood').textContent = !state.connected ? 'Taking a little break' : state.moisture < 40 ? 'A little thirsty…' : 'Growing happy ';
    }
}

async function waterPlant(automatic = false) {
    if (!state.connected) {
        notify('Vivi is disconnected', 'Reconnect in Settings before watering.');
        return;
    }
    if (state.watering) {
        $('viviSpeech').textContent = 'Watering is in progress. Just a moment.';
        return;
    }
    if (state.moisture >= 80) {
        notify('Vivi has enough water', 'The soil is hydrated. Watering will be available when it dries.');
        return;
    }
    const operation = ++wateringOperation;
    state.watering = true;
    render();
    $('viviSpeech').textContent = 'A little sip for my little roots…';
    notify(automatic ? 'Auto-watering started' : 'Watering started', 'Preparing a simulated 50 mL sip.', '');
    await new Promise((resolve) => setTimeout(resolve, 1800));
    // Disconnecting during a sip safely cancels it.
    if (operation !== wateringOperation) return;
    if (!state.connected) {
        state.watering = false;
        render();
        return;
    }
    state.moisture = Math.min(90, state.moisture + 25);
    state.sips += 1;
    state.lastWatered = new Date();
    state.watering = false;
    $('viviSpeech').textContent = 'Ahh, that hit the roots. Thank you! ';
    notify('One happy, hydrated Vivi', 'Simulated watering complete. 50 mL added.', '');
    render();
}

function checkAutoWater() {
    if (state.auto && state.connected && state.moisture < 40) waterPlant(true);
}

function setMotion() {
    document.body.classList.toggle('reduced-motion', state.reduced);
    $('reduceMotion').checked = state.reduced;
    $('viviCharacter').src = state.reduced
        ? 'assets/loved.png'
        : loving ? 'assets/Vivi_loved.gif' : 'assets/happy.gif';
}

function giveLove() {
    clearTimeout(loveTimer);
    loving = true;
    setMotion();
    $('viviCharacter').classList.remove('loved');
    void $('viviCharacter').offsetWidth;
    $('viviCharacter').classList.add('loved');
    $('screenMood').textContent = 'Feeling so loved! ';
    $('viviSpeech').textContent = 'You make my little heart grow! ';
    $('hearts').replaceChildren();
    if (!state.reduced) {
        for (let i = 0; i < 5; i++) {
            const heart = document.createElement('span');
            heart.className = 'heart';
            heart.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 3 12C-3 5 7-2 12 5 17-2 27 5 21 12Z"/></svg>';
            heart.style.left = `${15 + i * 15}%`;
            heart.style.animationDelay = `${i * 0.15}s`;
            $('hearts').append(heart);
        }
    }
    notify('Vivi feels loved', 'A little affection goes a long way. Thank you!', '');
    loveTimer = setTimeout(() => {
        loving = false;
        $('viviCharacter').classList.remove('loved');
        $('hearts').replaceChildren();
        setMotion();
        render();
    }, 5000);
}

$('settingsButton').addEventListener('click', () => $('settingsDialog').showModal());
$('connectionStatus').addEventListener('click', () => $('settingsDialog').showModal());
$('closeSettings').addEventListener('click', () => $('settingsDialog').close());
$('toggleConnection').addEventListener('click', () => {
    if (state.connected) {
        const wasWatering = state.watering;
        state.connected = false;
        wateringOperation += 1;
        state.watering = false;
        $('viviSpeech').textContent = 'Taking a tiny break. Come back soon!';
        notify('Vivi disconnected', wasWatering ? 'Watering cancelled. Sensors are paused.' : 'Sensors and automatic watering are paused.', '');
        render();
    } else {
        $('toggleConnection').disabled = true;
        $('toggleConnection').textContent = 'Connecting…';
        $('viviSpeech').textContent = 'Vivi is connecting…';
        connectionTimer = setTimeout(() => {
            state.connected = true;
            $('toggleConnection').disabled = false;
            $('viviSpeech').textContent = 'Back together, growing together! ';
            notify('Vivi is connected', 'Your simulated garden is live again.', '');
            render();
            checkAutoWater();
        }, 1200);
    }
});
$('autoWater').addEventListener('change', (event) => {
    state.auto = event.target.checked;
    savePreferences();
    notify(state.auto ? 'Auto-watering enabled' : 'Auto-watering paused', state.auto ? 'Vivi gets a sip below 40% moisture while connected.' : 'You can still water Vivi manually.', '');
    render();
    checkAutoWater();
});
$('waterButton').addEventListener('click', () => waterPlant());
$('waterNow').addEventListener('click', () => waterPlant());
$('loveButton').addEventListener('click', giveLove);
$('reduceMotion').addEventListener('change', (event) => {
    state.reduced = event.target.checked;
    setMotion();
    savePreferences();
});
$('clearNotes').addEventListener('click', () => {
    state.notes = [];
    renderNotes();
    clearTimeout(toastTimer);
    $('toast').classList.remove('visible');
    $('loveButton').focus({ preventScroll: true });
});

// Gentle drift makes the demo feel alive without needing hardware.
setInterval(() => {
    if (!state.connected || state.watering) return;
    const previous = state.moisture;
    state.moisture = Math.max(15, state.moisture - (0.7 + Math.random() * 1.1));
    state.light = Math.max(450, Math.min(950, state.light + (Math.random() - 0.5) * 60));
    state.temperature = Math.max(23, Math.min(29, state.temperature + (Math.random() - 0.5) * 0.4));
    if (previous >= 40 && state.moisture < 40 && !state.auto) {
        notify('Vivi needs a sip', 'Soil moisture is below 40%. Tap Water to help.', '');
        $('viviSpeech').textContent = 'Could my roots have a little drink?';
    }
    render();
    checkAutoWater();
}, 8000);

setMotion();
render();
renderNotes();

// Secondary details open as app sheets, never as desktop dashboard columns.
$('sensorButton').addEventListener('click', () => $('careDialog').showModal());
$('careButton').addEventListener('click', () => {
    $('careDialog').showModal();
    document.querySelector('.temperature').scrollIntoView({ block: 'center' });
});
$('waterTrackerButton').addEventListener('click', () => {
    $('careDialog').showModal();
    document.querySelector('.watering-panel').scrollIntoView({ block: 'center' });
});
$('closeCare').addEventListener('click', () => $('careDialog').close());
let speechTimer;
new MutationObserver(() => {
    $('viviSpeech').classList.add('show');
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => $('viviSpeech').classList.remove('show'), 3500);
}).observe($('viviSpeech'), { childList: true });

// Keep artwork labels tucked away until a button is activated.
const labelTimers = new Map();
document.querySelectorAll('.art-button').forEach((button) => {
    button.addEventListener('click', () => {
        clearTimeout(labelTimers.get(button));
        button.classList.add('show-label');
        labelTimers.set(button, setTimeout(() => {
            button.classList.remove('show-label');
        }, 1800));
    });
});

// Skins change only the shell; sensor state and controls stay intact.
const eggSkins = [
    { name: 'Sunshine', file: 'assets/egg.png' },
    { name: 'Strawberry Ribbon', file: 'assets/egg-strawberry.png' },
    { name: 'Flower Garden', file: 'assets/egg-garden.png' }
];
let selectedSkin = 0;
try {
    const savedSkin = localStorage.getItem('vivi-egg-skin');
    const savedIndex = eggSkins.findIndex((skin) => skin.name === savedSkin);
    if (savedIndex >= 0) selectedSkin = savedIndex;
} catch { /* Skins work even if browser storage is unavailable. */ }

function renderSkin() {
    const skin = eggSkins[selectedSkin];
    $('eggSkin').src = skin.file;
    $('eggSkin').alt = `${skin.name} egg shell`;
    $('skinAnnouncement').textContent = `${skin.name} egg selected, ${selectedSkin + 1} of ${eggSkins.length}`;
    try {
        localStorage.setItem('vivi-egg-skin', skin.name);
    } catch { /* Keep the current selection in memory. */ }
}

function changeSkin(direction) {
    selectedSkin = (selectedSkin + direction + eggSkins.length) % eggSkins.length;
    renderSkin();
}

$('previousSkin').addEventListener('click', () => changeSkin(-1));
$('nextSkin').addEventListener('click', () => changeSkin(1));
eggSkins.forEach((skin) => {
    const image = new Image();
    image.src = skin.file;
});
renderSkin();

// Relative URLs also work when hosted under a repository subdirectory.
if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {
            // A failed offline setup must never block the tracker.
        });
    });
}
