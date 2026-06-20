
# Dashboard Frontend

Folder ini adalah frontend React untuk simulasi load balancer dengan dua algoritma:

- Round Robin
- Least Connection

Dashboard ini sekarang dijalankan dari dalam stack Docker bersama tiga backend Node.js dan gateway Nginx.

## Menjalankan dengan Docker Desktop

1. Buka Docker Desktop sampai status engine aktif.
2. Buka terminal pada folder root proyek, misalnya `TUGAS LOAD BALANCER`.
3. Jalankan:

```powershell
docker compose up --build -d
```

4. Buka:

```text
http://localhost:8080
```

## Yang Ada di Dalam Stack

- `gateway`: Nginx yang melayani dashboard React sekaligus route API load balancer
- `service1`: backend Node.js dengan delay ekstra `1600 ms`
- `service2`: backend Node.js dengan delay ekstra `0 ms`
- `service3`: backend Node.js dengan delay ekstra `0 ms`

## Perintah Berguna

```powershell
docker compose ps
docker compose logs -f gateway
docker compose down
```

## Menjalankan Frontend Saja

Jika hanya ingin mengerjakan UI secara lokal:

```powershell
npm install
npm run dev
```

Mode ini hanya untuk pengembangan tampilan. Untuk demo tugas yang lengkap, gunakan Docker Compose dari root proyek.
  