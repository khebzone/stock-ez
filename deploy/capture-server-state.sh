#!/usr/bin/env bash
# ============================================================
#  Captures everything on the CURRENT server that is NOT in git,
#  so the new server can be rebuilt without missing anything.
#
#  Read-only. Changes nothing. Run on the OLD server:
#     bash capture-server-state.sh
#
#  Produces /tmp/stockez-state-<ts>.tar.gz  +  a printed summary.
#
#  ⚠  THE TARBALL CONTAINS SECRETS (.env, rclone.conf, TLS keys).
#     Move it with scp -O, never email it, delete both copies after.
# ============================================================
set -uo pipefail

TS=$(date +%Y%m%d-%H%M%S)
OUT="/tmp/stockez-state-$TS"
mkdir -p "$OUT"/{config,secrets,report}

say() { echo "  $*"; }
grab() {  # grab <dest-subdir> <path...>
  local dest="$OUT/$1"; shift
  for p in "$@"; do
    [ -e "$p" ] && { mkdir -p "$dest"; cp -a "$p" "$dest/" 2>/dev/null && say "captured $p"; }
  done
}

echo "=== Capturing server state ==="

# ---- secrets & runtime config (NOT in git) --------------------------------
echo "-- secrets --"
grab secrets /opt/stockez/backup.env
grab secrets ~/.config/rclone/rclone.conf /root/.config/rclone/rclone.conf
for d in /opt/stockez/deploy ~/stockez/deploy; do
  [ -f "$d/.env" ] && { cp "$d/.env" "$OUT/secrets/env-$(basename $(dirname $d))" && say "captured $d/.env"; }
  [ -d "$d/certs" ] && { cp -a "$d/certs" "$OUT/secrets/" && say "captured $d/certs"; }
done
grab secrets ~/.acme.sh/account.conf

# ---- system config --------------------------------------------------------
echo "-- system config --"
grab config /etc/fail2ban/jail.local /etc/fail2ban/jail.d /etc/fail2ban/filter.d/stockez-login.conf
grab config /etc/systemd/system/stockez.service
grab config /etc/apt/apt.conf.d/51unattended-tweaks
grab config /etc/logrotate.d/stockez /etc/logrotate.d/nginx

# ---- the report: state you cannot copy, only re-apply ----------------------
R="$OUT/report/REPORT.txt"
{
  echo "StockEz server state — captured $TS"
  echo "host: $(hostname)  ip: $(hostname -I 2>/dev/null | awk '{print $1}')"
  echo

  echo "=== TIMEZONE (must match on new server — cron, 2AM cleanup, day closure) ==="
  timedatectl 2>/dev/null | sed 's/^/  /'
  echo

  echo "=== SWAP ==="
  swapon --show 2>/dev/null | sed 's/^/  /' || echo "  NONE — add 4G on the new box"
  free -h | sed 's/^/  /'
  echo

  echo "=== DISK ==="
  df -h / 2>/dev/null | sed 's/^/  /'
  echo "  postgres volume:"
  docker system df -v 2>/dev/null | grep -i -A1 'VOLUME NAME' | sed 's/^/    /'
  echo

  echo "=== CRONTABS (re-create these) ==="
  echo "-- user $(whoami):"; crontab -l 2>/dev/null | sed 's/^/    /' || echo "    (none)"
  echo "-- root:";           sudo crontab -l 2>/dev/null | sed 's/^/    /' || echo "    (none)"
  echo "-- /etc/cron.d:";    ls -1 /etc/cron.d 2>/dev/null | sed 's/^/    /'
  echo

  echo "=== UFW ==="
  sudo ufw status verbose 2>/dev/null | sed 's/^/  /'
  echo

  echo "=== FAIL2BAN JAILS (stockez-login needs backend=polling + DOCKER-USER chain) ==="
  sudo fail2ban-client status 2>/dev/null | sed 's/^/  /'
  for j in sshd stockez-login; do
    echo "-- $j:"; sudo fail2ban-client status "$j" 2>/dev/null | sed 's/^/    /'
  done
  echo

  echo "=== ACME / TLS ==="
  ls -1 ~/.acme.sh 2>/dev/null | head -20 | sed 's/^/  /'
  echo "  acme cron:"; crontab -l 2>/dev/null | grep -i acme | sed 's/^/    /' || echo "    (none found)"
  for c in /opt/stockez/deploy/certs/*.pem ~/stockez/deploy/certs/*.pem; do
    [ -f "$c" ] && echo "  $c expires: $(openssl x509 -enddate -noout -in "$c" 2>/dev/null | cut -d= -f2)"
  done
  echo

  echo "=== RCLONE REMOTES (r2 needs no_check_bucket = true) ==="
  rclone listremotes 2>/dev/null | sed 's/^/  /'
  echo "  newest backup in R2:"
  rclone lsl r2:stockez-backups/frequent/ 2>/dev/null | sort -k2 | tail -3 | sed 's/^/    /'
  echo

  echo "=== DOCKER ==="
  docker compose -f /opt/stockez/deploy/docker-compose.prod.yml ps 2>/dev/null | sed 's/^/  /'
  echo "  volumes:"; docker volume ls 2>/dev/null | sed 's/^/    /'
  echo

  echo "=== .env KEYS PRESENT (values withheld) ==="
  for d in /opt/stockez/deploy ~/stockez/deploy; do
    [ -f "$d/.env" ] && { echo "  $d/.env:"; grep -oE '^[A-Z0-9_]+' "$d/.env" | sed 's/^/    /'; }
  done
  echo

  echo "=== DB SIZE / ROW SANITY ==="
  docker exec stockez-postgres psql -U stockez -d stockez -At -c \
    "SELECT 'db_size=' || pg_size_pretty(pg_database_size('stockez'));" 2>/dev/null | sed 's/^/  /'
  docker exec stockez-postgres psql -U stockez -d stockez -At -c \
    "SELECT 'tenants=' || count(*) FROM tenants;" 2>/dev/null | sed 's/^/  /'
  echo

  echo "=== LISTENING PORTS ==="
  sudo ss -tlnp 2>/dev/null | sed 's/^/  /'
} > "$R" 2>&1

cat "$R"

chmod -R go-rwx "$OUT"
tar czf "$OUT.tar.gz" -C /tmp "stockez-state-$TS"
rm -rf "$OUT"
chmod 600 "$OUT.tar.gz"

echo
echo "============================================================"
echo " Written: $OUT.tar.gz"
echo
echo " ⚠  CONTAINS SECRETS. Pull it down with:"
echo "     scp -O <user>@<this-host>:$OUT.tar.gz ."
echo " Then delete it here AND on your PC once the migration is done."
echo "============================================================"
