// src/background/background.js
const KEY_URL = 'https://proxy-api-1op.pages.dev/api/keys?token=9f73c1e8a1424e3fbf2d1f50ce7b1a2bgtyetw42';

let PROXIES = [];
let CREDS_1_10 = null;
let CREDS_11_20 = null;
let currentProfileIndex = -1;

// ======== Загрузка прокси и учёток в память ========
async function loadCredentialsFromServer() {
  try {
    const resp = await fetch(KEY_URL);
    if (!resp.ok) throw new Error('Ошибка загрузки ключей');
    const data = await resp.json();

    PROXIES = data.proxies;
    CREDS_1_10 = data.creds["1_10"];
    CREDS_11_20 = data.creds["11_20"];

    await chrome.storage.local.set({ PROXIES }); // только список прокси, без паролей
    console.log("✅ Ключи и прокси загружены в память (без сохранения паролей)");
  } catch (e) {
    console.error("❌ Не удалось загрузить ключи:", e.message);
  }
}

// ======== Получить логин/пароль по индексу (из памяти) ========
function getAuthCredentials() {
  if (currentProfileIndex >= 0 && currentProfileIndex < 10) {
    return CREDS_1_10;
  }
  if (currentProfileIndex >= 10 && currentProfileIndex < PROXIES.length) {
    return CREDS_11_20;
  }
  return null;
}

// ======== Создание proxy-конфига ========
function makeProxyConfig(idx) {
  const { ip, port } = PROXIES[idx];
  return {
    mode: "fixed_servers",
    rules: {
      singleProxy: { scheme: "http", host: ip, port },
      bypassList: ["<local>"]
    }
  };
}

// ======== Применить настройки прокси ========
function applySettings(proxyEnabled, selectedProfile) {
  currentProfileIndex = selectedProfile;

  const config = (proxyEnabled && selectedProfile >= 0)
    ? makeProxyConfig(selectedProfile)
    : { mode: "direct" };

  chrome.proxy.settings.set(
    { value: config, scope: "regular" },
    () => {
      if (chrome.runtime.lastError) {
        console.error("❌ Proxy settings error:", chrome.runtime.lastError);
      } else {
        console.log(`✅ Proxy ${proxyEnabled ? "ON" : "OFF"}, profile=${selectedProfile}`);
      }
    }
  );
}

// ======== Восстановление настроек при запуске ========
function restoreFromStorage() {
  chrome.storage.local.get(
    { proxyEnabled: false, selectedProfile: -1 },
    ({ proxyEnabled, selectedProfile }) => applySettings(proxyEnabled, selectedProfile)
  );
}

// ======== При установке и запуске браузера ========
chrome.runtime.onInstalled.addListener(async () => {
  await loadCredentialsFromServer();
  restoreFromStorage();
});
chrome.runtime.onStartup.addListener(async () => {
  await loadCredentialsFromServer();
  restoreFromStorage();
});

// ======== Обновление настроек из popup.js ========
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.proxyEnabled || changes.selectedProfile)) {
    restoreFromStorage();
  }
});

// ======== Прямые команды от popup.js ========
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "updateProxy") {
    applySettings(msg.proxyEnabled, msg.selectedProfile);
    sendResponse({ ok: true });
  }
});

// ======== Обработка авторизации ========
chrome.webRequest.onAuthRequired.addListener(
  details => {
    const creds = getAuthCredentials();
    if (creds) {
      console.log(`🔐 Авторизация для профиля ${currentProfileIndex}`);
      return { authCredentials: creds };
    }
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);