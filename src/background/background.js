// background.js
import { PROXIES } from '../services/proxies.js';
import { CREDS_1_10, CREDS_11_20 } from '../services/secrets.js';
import { getAuthCredentials } from '../utils/auth.js';


function getAuthCredentials() {
  if (currentProfileIndex < 10)       return CREDS_1_10;
  if (currentProfileIndex < PROXIES.length) return CREDS_11_20;
  return null;
}

// Текущий выбранный профиль
let currentProfileIndex = -1;

// Выдаём креды по индексу
function getAuthCredentials() {
  if (currentProfileIndex >= 0 && currentProfileIndex < 10)       return CREDS_1_10;
  if (currentProfileIndex >= 10 && currentProfileIndex < PROXIES.length) return CREDS_11_20;
  return null;
}

// Собираем proxy-конфиг по индексу
function makeProxyConfig(idx) {
  const { ip, port } = PROXIES[idx];
  return {
    mode: "fixed_servers",
    rules: {
      singleProxy: { scheme: "http", host: ip, port },
      bypassList:  ["<local>"]
    }
  };
}

// Применяем режим прокси (или прямое соединение)
function applySettings(proxyEnabled, selectedProfile) {
  currentProfileIndex = selectedProfile;
  const config = (proxyEnabled && selectedProfile >= 0)
               ? makeProxyConfig(selectedProfile)
               : { mode: "direct" };

  chrome.proxy.settings.set(
    { value: config, scope: "regular" },
    () => {
      if (chrome.runtime.lastError) {
        console.error("Proxy settings error:", chrome.runtime.lastError);
      } else {
        console.log(`Proxy ${proxyEnabled ? "ON" : "OFF"}, profile=${selectedProfile}`);
      }
    }
  );
}

// При установке расширения
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    { proxyEnabled: false, selectedProfile: -1 },
    ({ proxyEnabled, selectedProfile }) => applySettings(proxyEnabled, selectedProfile)
  );
});

// При старте (после перезапуска браузера/service-worker)
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(
    { proxyEnabled: false, selectedProfile: -1 },
    ({ proxyEnabled, selectedProfile }) => applySettings(proxyEnabled, selectedProfile)
  );
});

// Слушаем изменение chrome.storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" &&
      (changes.proxyEnabled   !== undefined ||
       changes.selectedProfile !== undefined)) {
    chrome.storage.local.get(
      { proxyEnabled: false, selectedProfile: -1 },
      ({ proxyEnabled, selectedProfile }) => applySettings(proxyEnabled, selectedProfile)
    );
  }
});

// Запасной вариант: месседж от popup для мгновенного срабатывания
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "updateProxy") {
    applySettings(msg.proxyEnabled, msg.selectedProfile);
    sendResponse({ ok: true });
  }
});

// Авторизация на запросах к прокси
chrome.webRequest.onAuthRequired.addListener(
  details => {
    const creds = getAuthCredentials();
    return creds ? { authCredentials: creds } : {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

