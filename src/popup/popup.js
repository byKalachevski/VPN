// popup.js

// Сколько профилей надо отрисовать
const PROFILE_COUNT = 10;

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("profiles");

  // Обновляет состояние переключателей и текст On/Off
  function updateUI(selectedProfile, proxyEnabled) {
    for (let idx = 0; idx < PROFILE_COUNT; idx++) {
      const input  = document.getElementById(`toggle${idx}`);
      const status = document.getElementById(`status${idx}`);
      const isActive = proxyEnabled && selectedProfile === idx;
      input.checked      = isActive;
      status.textContent = isActive ? "On" : "Off";
    }
  }

  // Рисуем ровно PROFILE_COUNT записей
  for (let idx = 0; idx < PROFILE_COUNT; idx++) {
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
        chrome.storage.local.set(
          { proxyEnabled: true, selectedProfile: idx },
          () => {
            updateUI(idx, true);
            chrome.runtime.sendMessage({
              action: "updateProxy",
              proxyEnabled: true,
              selectedProfile: idx
            });
          }
        );
      } else {
        chrome.storage.local.set(
          { proxyEnabled: false, selectedProfile: -1 },
          () => {
            updateUI(-1, false);
            chrome.runtime.sendMessage({
              action: "updateProxy",
              proxyEnabled: false,
              selectedProfile: -1
            });
          }
        );
      }
    });
  }

  // При открытии popup тянем текущее состояние
  chrome.storage.local.get(
    { proxyEnabled: false, selectedProfile: -1 },
    ({ proxyEnabled, selectedProfile }) => {
      updateUI(selectedProfile, proxyEnabled);
    }
  );
});
