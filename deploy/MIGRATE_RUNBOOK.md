# StockEz — Move to a New Server

Host-agnostic. Works for OVH VPS-3, Contabo VPS 6, MilesWeb SM-L2, or a resized E2E box.

**The old server stays running the whole time.** You only cut DNS over once the new
one has served a real login. If anything goes wrong, you have changed nothing.

> 💻 = your Windows PC · 🖥️ = server (SSH) · ☁️ = browser

---

## 0. 🖥️ Prove the backup works — on the OLD server, before anything else

```bash
cd /opt/stockez/deploy
bash verify-backup.sh
```

This restores the newest R2 backup into a throwaway container and diffs row counts
against live. Production is only read.

- **PASSED** → note the recovery time it prints. Continue.
- **FAILED** → stop. Do not migrate. Fix backups first — a migration *is* a restore,
  and you would be performing your first one under time pressure with live clients.

Then capture everything on the old box that is **not** in git:

```bash
bash capture-server-state.sh
```

Read the printed report and pull the tarball down (`scp -O`). It contains `.env`,
`rclone.conf` and TLS keys — delete both copies once the migration is done.

Everything in that report is something `harden-server.sh` will **not** recreate for you.

---

## 1. ☁️ Create the server

Ubuntu 24.04, **SSH key only — never a password.** Paste your `id_ed25519.pub` at
creation. Note the new IP as `<NEW_IP>`.

Add swap immediately (the Maven build needs it on 8 GB, and it's cheap insurance on 12):

```bash
ssh root@<NEW_IP>
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 2. 🖥️ Harden before the app exists

```bash
scp deploy/harden-server.sh root@<NEW_IP>:~
ssh root@<NEW_IP> 'bash harden-server.sh stockez 22'
```

**Open a second terminal and confirm `ssh stockez@<NEW_IP>` works before closing the first.**
Locking yourself out of a half-built box is recoverable; doing it after cutover is not.

## 3. 💻 Copy code and secrets

```bash
scp -r ./StockEz stockez@<NEW_IP>:~/stockez
scp -O stockez@<OLD_IP>:/opt/stockez/deploy/.env ./env.tmp
scp -O ./env.tmp stockez@<NEW_IP>:~/stockez/deploy/.env
del env.tmp
```

Then on the new box: `chmod 600 ~/stockez/deploy/.env`

Edit `.env` and set:
- `BASE_URL` → your domain (unchanged)
- `ORPHAN_CLEANUP_ENABLED=false` → **leave off until after cutover.** The 2 AM job
  deletes R2 images not referenced in the DB; if it runs against an empty or
  half-restored database it wipes your product images.

## 4. 🖥️ Certificates

Copy the existing wildcard cert rather than re-issuing — it saves refreshing the
`_acme-challenge` TXT records at Hostinger while under pressure:

```bash
scp -O -r stockez@<OLD_IP>:/opt/stockez/deploy/certs ~/stockez/deploy/certs
```

## 5. 🖥️ Bring the stack up — with tuning

```bash
cd ~/stockez/deploy
docker compose -f docker-compose.prod.yml -f docker-compose.tuning.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Adjust the memory values in `docker-compose.tuning.yml` first if your box is 8 GB —
the comments give the alternative numbers.

Flyway creates the schema on first boot. **Do not import anything by hand.**

## 6. 🖥️ Load production data

```bash
rclone copy r2:stockez-backups/frequent/ /tmp/r/ --max-age 1h
bash restore.sh /tmp/r/stockez_*.sql.gz
```

Verify before trusting it:

```bash
docker exec stockez-postgres psql -U stockez -d stockez -c \
  "SELECT (SELECT count(*) FROM customers) AS customers,
          (SELECT count(*) FROM products)  AS products,
          (SELECT count(*) FROM orders)    AS orders;"
```

Compare against the same query on the old server. They should match.

## 7. 💻 Test before touching DNS

Point your own machine at the new server without affecting any client — add to
`C:\Windows\System32\drivers\etc\hosts` (as Administrator):

```
<NEW_IP>  stockez.in www.stockez.in
```

Now log in as admin and check, at minimum:
- a customer's outstanding balance is correct
- product images load (R2, not local)
- create a test order → FIFO batch deduction works
- print an invoice PDF

Remove the hosts entry when done.

## 8. ☁️ Cut over

Only after step 7 passes.

1. At **Hostinger DNS**, lower TTL on `@`, `www`, `*` to 300s. Wait for the old TTL to expire.
2. Point all three A records to `<NEW_IP>`.
3. Watch: `docker compose -f docker-compose.prod.yml logs -f stockez-web`
4. **Do a final catch-up restore.** Orders placed during the DNS switch landed on the
   OLD server. Take a fresh dump there and restore it onto the new box, or do the
   cutover outside 9am–12pm when nobody is billing.

## 9. 🖥️ Re-arm the safety net — same day, not "later"

`harden-server.sh` gives you the user, SSH lockdown, ufw, the **sshd** fail2ban jail,
unattended-upgrades, Docker and rclone. Everything below was done **by hand** on E2E and
exists in no script. Work through it against your `capture-server-state.sh` report.

### 9a. Timezone — do this first

Cron drives the 5-minute backup, the daily 02:00 backup tier and the 2 AM orphan cleanup.
Day Closure logic is also date-sensitive. A UTC box silently shifts all of it by 5h30m.

```bash
sudo timedatectl set-timezone Asia/Kolkata
```

### 9b. rclone remote

Not created by any script, and interactive:

```bash
rclone config          # add remote 'r2' — type s3, provider Cloudflare
```

Then add `no_check_bucket = true` under `[r2]` in `~/.config/rclone/rclone.conf`.
Without it the R2 token can't ListBuckets/CreateBucket and every upload 403s.
Simplest path: copy the `[r2]` block straight out of the captured `rclone.conf`.

```bash
rclone lsl r2:stockez-backups/frequent/ | tail -3   # must list files
```

### 9c. Backups — mind the stale installer

```bash
bash install-backups.sh
```

⚠ **`install-backups.sh` is out of date and will not carry your alerting across.**
It generates a fresh `backup.env` containing `ENC_PASSPHRASE` and `GDRIVE_REMOTE`, which
current `backup.sh` ignores (backups are plain gzip by design) — and it omits
`HEALTHCHECK_URL`, so your dead-man's-switch would be silently disabled on the new server.

After running it, restore the real values from the captured `backup.env`:

```bash
sudo nano /opt/stockez/backup.env      # add HEALTHCHECK_URL=... from the old box
/opt/stockez/backup.sh && tail /var/log/stockez-backup.log
bash verify-backup.sh                  # drill again, on the NEW server
```

Confirm healthchecks.io shows a fresh ping before you trust it.

### 9d. fail2ban web jail

```bash
sudo cp fail2ban/filter.d-stockez-login.conf /etc/fail2ban/filter.d/stockez-login.conf
sudo cp fail2ban/jail.d-stockez-login.conf   /etc/fail2ban/jail.d/stockez-login.conf
mkdir -p ~/stockez/deploy/nginx-logs        # must exist BEFORE compose mounts it
sudo systemctl restart fail2ban
sudo fail2ban-client status stockez-login
```

Both gotchas still apply and both are required:
- `backend = polling` — Ubuntu 24.04 defaults fail2ban to the systemd journal, which ignores `logpath`
- `action = iptables-allports[chain="DOCKER-USER"]` — a normal INPUT ban does **not** reach Docker-published ports

### 9e. TLS renewal

The cert was copied in step 4, so the site works — but **renewal is not set up** until you
reinstall acme.sh and its cron. The wildcard uses DNS-01 in manual mode, so renewal needs the
`_acme-challenge` TXT records refreshed at Hostinger. Check the expiry date in your captured
report and don't let it lapse.

### 9f. Log rotation

Neither `/var/log/stockez-backup.log` (288 entries/day) nor the mounted `nginx-logs/` rotate
by default. On a 75–100 GB disk they will grow unbounded. Add a `/etc/logrotate.d/stockez`
entry for both.

### 9g. Remaining items

- 💻 `C:\Users\Kathiravan\StockEz-Tools\sync-backups.ps1` → `<NEW_IP>` (keeps the `-O` scp flag)
- 💻 `deploy.bat` → `<NEW_IP>`
- 🖥️ `ORPHAN_CLEANUP_ENABLED=true` once you've confirmed product images resolve
- 🖥️ Re-add the 4 GB swap if you skipped step 1
- ☁️ Verify the Windows task **StockEz-Backup-Sync** pulls from the new host

### 9h. Operational reminder that carries over

After **any** direct SQL against the production database, run `redis-cli FLUSHALL` inside the
redis container. A restart does not clear it, and the app will serve stale cache for up to 6h.

## 10. Keep the old server for 7 days

Do not delete it the same day. Run both in parallel for a week. It costs one extra
month at worst; deleting early cost you eleven days of data last time.

---

## Rollback

Any problem before step 8: change nothing, the old server is still live.
Any problem after step 8: point the DNS A records back to `<OLD_IP>`.
