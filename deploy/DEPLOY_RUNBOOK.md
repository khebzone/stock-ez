# StockEz — Secure Rebuild Runbook (DigitalOcean)

Goal: a **hardened** (no-hack) server with **synced off-site backups** (no data loss),
running your existing app + data. Follow top to bottom. Each step is small.

> Legend: 💻 = on your Windows PC · 🖥️ = on the server (SSH) · ☁️ = in a browser

---

## 0. Before you start — rotate secrets
The old DB password, JWT secret, and **R2 keys** were on the hacked server.
- ☁️ Cloudflare → R2 → **Manage API Tokens** → create NEW keys, delete old ones.
- Generate new secrets later in Step 4.

## 1. 💻 Create your SSH key (if you don't have one)
```bash
ssh-keygen -t ed25519 -C "stockez"
# press enter for defaults; note the path, e.g. C:\Users\Kathiravan\.ssh\id_ed25519.pub
```

## 2. ☁️ Create the DigitalOcean droplet
- Sign up at digitalocean.com, verify identity + payment.
- Create Droplet: **Ubuntu 22.04**, region **Bangalore (BLR1)**, **4 GB / 2 vCPU**.
- Authentication: **SSH Key** → paste the contents of your `id_ed25519.pub`.
- Create. Copy the **public IP** it gives you.

## 3. 🖥️ Harden the server (closes the hack)
```bash
ssh root@<SERVER_IP>
# upload/paste harden-server.sh, then:
bash harden-server.sh stockez 22 <YOUR_HOME_IP>   # 3rd arg optional
```
**Before closing**, open a NEW terminal and confirm: `ssh stockez@<SERVER_IP>` works.
Now: password login off, root off, firewall on, fail2ban on, Docker + rclone installed.

## 4. 🖥️ Get the code + secrets
```bash
# copy your project up (from 💻 PC):  scp -r ./StockEz stockez@<SERVER_IP>:~/stockez
cd ~/stockez/deploy
cp .env.production.example .env
# generate strong secrets:
echo "DB_PASSWORD=$(openssl rand -base64 24)"
echo "JWT_SECRET=$(openssl rand -base64 48)"
nano .env    # paste the above + your NEW R2 keys + super admin + BASE_URL
```

## 5. ☁️🖥️ Cloudflare (hides your IP + SSL)
- ☁️ Cloudflare → your domain → DNS: add `A` record `app` → `<SERVER_IP>`, **Proxy ON (orange)**.
- ☁️ SSL/TLS → set mode **Full (strict)**.
- ☁️ SSL/TLS → Origin Server → **Create Certificate** → save the cert + key.
- 🖥️ `mkdir -p ~/stockez/deploy/certs` then paste them into
  `deploy/certs/origin.pem` and `deploy/certs/origin.key`.

## 6. 🖥️ Launch the app
```bash
cd ~/stockez/deploy
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps      # all healthy?
docker compose -f docker-compose.prod.yml logs -f stockez-api   # watch it start
```
Flyway runs your V1–V22 migrations automatically → schema + seed created.
Visit `https://app.stockez.in` — the login page should load.

## 7. 🖥️ Turn on synced backups (no data loss)
```bash
# configure rclone remotes (interactive):
rclone config     # add 'r2'  (type: s3, provider: Cloudflare, your R2 keys)
rclone config     # add 'gdrive' (type: drive) — for the daily 2nd copy
# create the R2 backup bucket in the Cloudflare dashboard: 'stockez-backups'
cd ~/stockez/deploy
bash install-backups.sh
# >>> SAVE the ENC_PASSPHRASE it prints into your password manager! <<<
/opt/stockez/backup.sh && tail /var/log/stockez-backup.log   # test one run
```
Now: encrypted backup every 5 min → R2, daily copy → Google Drive.

## 8. 🖥️ Import your data
Log into the app as admin → Import screens, in THIS order:
1. Products  → `PRODUCT-11.06.2026 2.00 PM.xlsx`
2. Customers → `customers-template.xlsx`
3. Customer opening balances → `IMPORT_customer-opening-balances.csv` (save as .xlsx first)
4. Suppliers → `suppliers-2026-07-10.xlsx`
Then reconcile Jul 7–14 orders/payments from your salesmen's books.

## 9. Verify
- Log in, open a customer → outstanding balance shows.
- Create a test order.
- Confirm a backup file exists: `rclone ls r2:stockez-backups/frequent/`
- Restore drill (recommended once): follow `restore.sh` on a throwaway.

---

### Daily safety = 3 copies at once
live DB (server) + R2 (every 5 min) + Google Drive (daily). This disaster cannot repeat.
