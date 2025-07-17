// options.js
const form = document.getElementById('credsForm');
// при загрузке — подгружаем ранее сохранённые значения
chrome.storage.local.get(['CREDS_1_10', 'CREDS_11_20'], data => {
  if (data.CREDS_1_10) {
    form.u1.value = data.CREDS_1_10.username;
    form.p1.value = data.CREDS_1_10.password;
    form.u2.value = data.CREDS_11_20.username;
    form.p2.value = data.CREDS_11_20.password;
  }
});
form.addEventListener('submit', e => {
  e.preventDefault();
  const CREDS_1_10  = { username: form.u1.value, password: form.p1.value };
  const CREDS_11_20 = { username: form.u2.value, password: form.p2.value };
  chrome.storage.local.set({ CREDS_1_10, CREDS_11_20 }, () => {
    alert('Сохранено!');
  });
});
