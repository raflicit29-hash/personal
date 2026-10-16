# MR ALL IN Personal MVP

Aplikasi terpisah dari MR ALL IN Business V2. Jangan menimpa repo `demodagang` atau `mrallstore`.

## Fitur MVP
- Login Supabase email/password
- Akun pribadi dan saldo awal terverifikasi
- Pemasukan/pengeluaran manual
- Ringkasan arus kas 7 hari dan kategori pengeluaran terbesar
- RLS owner-only untuk data Personal

## Pasang
1. Buat repo GitHub baru, misalnya `mr-all-personal`.
2. Upload isi folder ini ke root repo.
3. Jalankan `supabase/migrations/001_personal_mvp.sql` melalui Supabase SQL Editor pada project yang sama.
4. Aktifkan GitHub Pages dari branch utama/root.
5. Buka halaman Personal, isi URL dan publishable key, simpan konfigurasi, lalu login.
6. Tambahkan akun pribadi dan transaksi contoh.

## Belum termasuk
Integrasi otomatis WD dari Business, transfer antar-akun, utang/piutang, target tabungan, closing harian, realtime, backup/restore, dan sinkronisasi bank. Jangan mengimpor draft historis sebagai saldo sekarang tanpa rekonsiliasi. Jangan pernah memasukkan service-role/secret key di frontend.
