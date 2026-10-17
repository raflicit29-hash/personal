# MR ALL IN Personal — Vibrant UI Refresh

Paket ini menyegarkan antarmuka MR ALL IN Personal dengan dashboard dark neon, ikon berwarna, ilustrasi target impian, animasi CSS ringan, navigasi desktop dan mobile, serta kartu aksi cepat. Pembaruan visual mempertahankan ID elemen dan alur fungsi di versi Full V2.

## Berkas yang diubah

- `index.html` — layout dan navigasi baru; semua ID formulir yang dipakai `assets/js/app.js` dipertahankan.
- `assets/css/style.css` — tema visual, responsive layout, animasi sederhana, dan dukungan `prefers-reduced-motion`.
- `assets/js/app.js` — panel login disembunyikan setelah login, pesan status juga terlihat di dashboard, pengantar sesuai waktu lokal, serta klik inspirasi target mengisi nama pada form target.
- `assets/img/` — ilustrasi dekoratif untuk hero dan kartu inspirasi tabungan.

## Instalasi pada repo yang sudah berjalan

1. Buat backup/commit keadaan repo sekarang.
2. Replace hanya `index.html`, `assets/css/style.css`, dan `assets/js/app.js` dari paket ini.
3. Upload folder `assets/img/` beserta lima file JPG-nya ke repo, pertahankan path `assets/img/...`.
4. Jangan jalankan migration SQL lagi untuk pembaruan visual ini.
5. Commit, buka situs, dan lakukan hard refresh (`Ctrl + Shift + R`).

## Catatan penting

- Pembaruan ini tidak mengubah skema Supabase.
- Angka dashboard tetap berasal dari data aplikasi; inspirasi tabungan hanya mengisi nama preset, tidak mengatur nominal target otomatis.
- Animasi dapat dikurangi otomatis sesuai pengaturan `prefers-reduced-motion` di perangkat.
- Tidak ada Google Fonts eksternal agar antarmuka tidak memerlukan request font pihak ketiga.
- Paket belum diuji langsung pada proyek Supabase aktif. Setelah dipasang, uji login, pencatatan akun/transaksi, transfer, laporan, target/setoran, anggaran, utang/pembayaran, ekspor, dan pemulihan backup.
- Business V2 tidak disentuh; integrasi otomatis Business → Personal belum diaktifkan.


## Integrasi MR ALL IN Business → Personal

Modul WD/Gaji Owner di Business dapat mengirim WD baru ke `personal_transactions` sebagai `income` dengan kategori `Gaji/WD dari bisnis`, sumber `business_transfer`, dan `source_transfer_id` UUID unik. Sambungkan dari Business menggunakan Project URL dan publishable/anon key yang sama dengan konfigurasi Personal, login dengan akun Personal, lalu pilih rekening penerima. Password tidak disimpan oleh modul Business. Pastikan migration `001_personal_mvp.sql` sudah pernah dijalankan pada proyek Supabase Personal. WD lama tidak diimpor otomatis; sinkronkan hanya transaksi baru atau gunakan tombol coba ulang untuk WD yang berstatus pending.
