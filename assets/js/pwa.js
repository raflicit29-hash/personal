(() => {
  const button = document.getElementById('installAppBtn');
  let deferredPrompt = null;
  if (!button) return;

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
  const isAndroid = () => /android/i.test(window.navigator.userAgent);

  if (isStandalone()) {
    button.hidden = true;
    button.classList.add('hidden');
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    button.textContent = '📲 Instal';
    button.title = 'Instal MR ALL IN Personal ke perangkat ini';
  });

  button.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
      deferredPrompt = null;
      if (result.outcome === 'accepted') {
        button.classList.add('hidden');
      } else {
        button.textContent = '📲 Instal lagi';
      }
      return;
    }

    let message;
    if (isIOS()) {
      message = 'Untuk memasang MR ALL IN Personal di iPhone/iPad: buka situs ini di Safari, tekan tombol Share, lalu pilih “Add to Home Screen / Tambahkan ke Layar Utama”.';
    } else if (isAndroid()) {
      message = 'Untuk memasang MR ALL IN Personal: buka situs ini dengan Chrome, tekan menu ⋮, lalu pilih “Install app / Instal aplikasi” atau “Add to Home screen / Tambahkan ke layar utama”. Jika opsi belum muncul, muat ulang situs dan pastikan koneksi aktif.';
    } else {
      message = 'Untuk memasang MR ALL IN Personal di komputer: di Chrome, buka menu ⋮ lalu cari “Install page as app / Instal halaman sebagai aplikasi” atau gunakan ikon instal di sisi kanan address bar bila tersedia.';
    }
    window.alert(message);
  });

  window.addEventListener('appinstalled', () => {
    button.classList.add('hidden');
    button.hidden = true;
  });

  // Register only the local app shell. The service worker never caches Supabase requests.
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .catch(error => console.warn('PWA service worker gagal didaftarkan:', error));
    }, { once: true });
  }
})();
