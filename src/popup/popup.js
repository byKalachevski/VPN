// popup.js

// Массив из 20 прокси — порядок должен совпадать с background.js
const PROXIES = [
  { ip: "185.88.99.20",   port: 8000 },
  { ip: "185.88.98.52",   port: 8000 },
  { ip: "185.88.98.42",   port: 8000 },
  { ip: "185.88.99.10",   port: 8000 },
  { ip: "185.88.99.249",  port: 8000 },
  { ip: "185.88.99.182",  port: 8000 },
  { ip: "185.88.98.200",  port: 8000 },
  { ip: "185.88.98.164",  port: 8000 },
  { ip: "185.88.99.52",   port: 8000 },
  { ip: "185.88.99.196",  port: 8000 },
  { ip: "45.146.129.66",  port: 8000 },
  { ip: "45.118.251.90",  port: 8000 },
  { ip: "45.154.229.5",   port: 8000 },
  { ip: "193.41.38.166",  port: 8000 },
  { ip: "45.154.229.219", port: 8000 },
  { ip: "45.154.229.27",  port: 8000 },
  { ip: "45.154.229.162", port: 8000 },
  { ip: "193.41.38.34",   port: 8000 },
  { ip: "193.41.38.103",  port: 8000 },
  { ip: "45.154.229.97",  port: 8000 }
];

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("profiles");

  // Обновляет состояние чекбоксов и текста On/Off
  function updateUI(selectedProfile, proxyEnabled) {
    PROXIES.forEach((_, idx) => {
      const input  = document.getElementById(`toggle${idx}`);
      const status = document.getElementById(`status${idx}`);
      const isActive = proxyEnabled && selectedProfile === idx;
      input.checked      = isActive;
      status.textContent = isActive ? "On" : "Off";
    });
  }

  // Рисуем 20 строк: метка "Profile N", переключатель и статус
  PROXIES.forEach((_, idx) => {
    const row = document.createElement("div");
    row.className = "profile-row";

    const label = document.createElement("span");
    label.className = "profile-label";
    label.textContent = `Profile ${idx + 1}`;

    const switchLabel = document.createElement("label");
    switchLabel.className = "switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id   = `toggle${idx}`;
    const slider = document.createElement("span");
    slider.className = "slider";
    switchLabel.append(input, slider);

    const status = document.createElement("span");
    status.id        = `status${idx}`;
    status.className = "status";

    row.append(label, switchLabel, status);
    container.appendChild(row);

    input.addEventListener("change", () => {
      if (input.checked) {
        // Включаем прокси для выбранного профиля
        chrome.storage.local.set(
          { proxyEnabled: true, selectedProfile: idx },
          () => {
            updateUI(idx, true);
            // Немедленно сообщаем фоновому скрипту о новых настройках
            chrome.runtime.sendMessage({
              action: "updateProxy",
              proxyEnabled: true,
              selectedProfile: idx
            });
          }
        );
      } else {
        // Отключаем прокси (сбрасываем выбранный профиль)
        chrome.storage.local.set(
          { proxyEnabled: false, selectedProfile: -1 },
          () => {
            updateUI(-1, false);
            // Немедленно сообщаем фоновому скрипту о новых настройках
            chrome.runtime.sendMessage({
              action: "updateProxy",
              proxyEnabled: false,
              selectedProfile: -1
            });
          }
        );
      }
    });
  });

  // Подтягиваем текущее состояние при открытии popup
  chrome.storage.local.get(
    { proxyEnabled: false, selectedProfile: -1 },
    ({ proxyEnabled, selectedProfile }) => {
      updateUI(selectedProfile, proxyEnabled);
      // Также можно сразу оповестить background о том, что popup открыт
      // и подтягивает конфиг (не обязательно):
      chrome.runtime.sendMessage({
        action: "updateProxy",
        proxyEnabled,
        selectedProfile
      });
    }
  );
});




