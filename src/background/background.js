// src/background/background.js

// — зашифрованный токен + ключ XOR —
const _ENC_TOKEN = 'SlVUQVBFLgsYQgdRRlZHLVEfQVdSFAZEKFZOEQICQFETP0ocB0RXQA==';
const _XOR_KEY   = 's3cr3tK3y';

function decryptToken() {
  const encrypted = atob(_ENC_TOKEN);
  const buf = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    buf[i] = encrypted.charCodeAt(i);
  }
  const keyBytes = new TextEncoder().encode(_XOR_KEY);
  const out = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(out);
}

const KEY_URL = `https://proxy-api-1op.pages.dev/api/keys?token=${decryptToken()}`;

// In-memory storage
let PROXIES = [];
let CREDS_1_10 = [];
let CREDS_11_20 = [];
let currentProfileIndex = -1;

// ======== Fetch & normalize credentials ========
async function loadCredentialsFromServer() {
  const resp = await fetch(KEY_URL);
  if (!resp.ok) throw new Error(`Status ${resp.status}`);
  const data = await resp.json();

  PROXIES     = Array.isArray(data.proxies)      ? data.proxies      : [];
  CREDS_1_10  = Array.isArray(data.creds?.['1_10'])  ? data.creds['1_10']  : [];
  CREDS_11_20 = Array.isArray(data.creds?.['11_20']) ? data.creds['11_20'] : [];

  // trim to 10 each
  CREDS_1_10  = CREDS_1_10.slice(0, 10);
  CREDS_11_20 = CREDS_11_20.slice(0, 10);

  await chrome.storage.sync.set({ PROXIES, CREDS_1_10, CREDS_11_20 });
  console.log('✅ Loaded proxies & creds');
}

// ======== Ensure credentials are loaded before using ========
async function ensureCredentials() {
  if (PROXIES.length === 0) {
    await loadCredentialsFromServer();
  }
}

// ======== Get auth creds for currentProfileIndex ========
function getAuthCredentials() {
  const i = currentProfileIndex;
  if (i >= 0 && i < 10)        return CREDS_1_10[i]   || null;
  if (i >= 10 && i < PROXIES.length) return CREDS_11_20[i - 10] || null;
  return null;
}

// ======== Build proxy config ========
function makeProxyConfig(idx) {
  const p = PROXIES[idx];
  if (!p) {
    console.error('❌ Invalid proxy index:', idx);
    return { mode: 'direct' };
  }
  return {
    mode: 'fixed_servers',
    rules: {
      singleProxy: {
        scheme: 'http',
        host: p.ip,
        port: Number(p.port)
      },
      bypassList: ['<local>']
    }
  };
}

// ======== Update Proxy-Authorization header rule ========
async function updateAuthHeaderRule() {
  const ruleId = 1;
  if (!chrome.declarativeNetRequest?.updateDynamicRules) return;

  const creds = getAuthCredentials();
  if (creds?.username && creds?.password) {
    const basic = btoa(`${creds.username}:${creds.password}`);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleId],
      addRules: [{
        id: ruleId,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [{
            header: 'Proxy-Authorization',
            operation: 'set',
            value: `Basic ${basic}`
          }]
        },
        condition: { urlFilter: '*', resourceTypes: ['main_frame','sub_frame','xmlhttprequest','script','other'] }
      }]
    });
    console.log('✅ Proxy-Authorization header set');
  } else {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] });
    console.log('✅ Proxy-Authorization header removed');
  }
}

// ======== Apply proxy + header ===============
async function applySettings(proxyEnabled, selectedProfile) {
  // ensure credentials & proxies are in memory
  await ensureCredentials();

  // use 0-based selectedProfile
  const idx = Number(selectedProfile);
  currentProfileIndex = (isNaN(idx) ? -1 : idx);

  // persist settings
  await chrome.storage.sync.set({ proxyEnabled, selectedProfile: currentProfileIndex });

  // set proxy config
  const config = proxyEnabled && currentProfileIndex >= 0
    ? makeProxyConfig(currentProfileIndex)
    : { mode: 'direct' };

  chrome.proxy.settings.set({ value: config, scope: 'regular' }, () => {
    if (chrome.runtime.lastError) {
      console.error('❌ proxy.settings.set error:', chrome.runtime.lastError);
    } else {
      console.log(`✅ Proxy ${proxyEnabled ? 'ON' : 'OFF'}, profile#${currentProfileIndex+1}`);
    }
  });

  // update header rule
  await updateAuthHeaderRule();
}

// ======== Initialization ===========
async function init() {
  // load from server once
  await loadCredentialsFromServer();

  // read saved settings
  const { proxyEnabled = false, selectedProfile = -1 } =
    await chrome.storage.sync.get(['proxyEnabled','selectedProfile']);

  await applySettings(proxyEnabled, selectedProfile);
}

// ======== Listeners ================
chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.proxyEnabled || changes.selectedProfile)) {
    chrome.storage.sync.get(['proxyEnabled','selectedProfile'])
      .then(({ proxyEnabled, selectedProfile }) =>
        applySettings(proxyEnabled, selectedProfile)
      );
  }
});

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.action === 'updateProxy') {
    applySettings(msg.proxyEnabled, msg.selectedProfile)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

// immediately init
init();