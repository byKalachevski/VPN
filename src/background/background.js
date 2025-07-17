// src/background/background.js
import { PROXIES } from '../services/proxies.js';
import { CREDS_1_10, CREDS_11_20 } from '../services/secrets.js';

// ======== Текущий активный профиль ========
let currentProfileIndex = -1;

// ======== Получить логин/пароль по индексу ========
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

// ======== Применить настройки (вкл/выкл) ========
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

// ======== При установке / запуске браузера ========
function restoreFromStorage() {
  chrome.storage.local.get(
    { proxyEnabled: false, selectedProfile: -1 },
    ({ proxyEnabled, selectedProfile }) => applySettings(proxyEnabled, selectedProfile)
  );
}

chrome.runtime.onInstalled.addListener(restoreFromStorage);
chrome.runtime.onStartup.addListener(restoreFromStorage);

// ======== При изменении в popup (через storage) ========
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.proxyEnabled || changes.selectedProfile)) {
    restoreFromStorage();
  }
});

// ======== Прямое сообщение от popup.js ========
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "updateProxy") {
    applySettings(msg.proxyEnabled, msg.selectedProfile);
    sendResponse({ ok: true });
  }
});

// ======== Авторизация на прокси-сервере ========
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


