#!/usr/bin/env bash
# ============================================================
#  StockEz backup -> Cloudflare R2 (plain gzip, no encryption)
#  Runs from cron every 5 minutes. Dumps Postgres, gzips it,
#  and uploads off-site to R2. Restores need only `gunzip`.
#
#  Retention:  frequent = 6h   hourly = 3d   daily = 60d
#
#  Also mirrors product images (R2 -> R2) every Sunday 02:30.
#  That step uses `copy`, never `sync`: it only ever ADDS to the
#  archive. An image deleted from the live bucket stays in the
#  archive forever, which is the whole point — 242 images were
#  lost in 2026 and the one manual copy held the wrong generation.
# ============================================================
set -euo pipefail

CFG=/opt/stockez/backup.env
[ -f "$CFG" ] && source "$CFG"

# Hosts with IPv6 (Contabo) egress over v6 by default, and rclone is Go — it
# ignores /etc/gai.conf. The R2 token is IP-filtered, so bind to the v4 address.
# Set RCLONE_BIND in backup.env on such hosts; leave unset elsewhere.
[ -n "${RCLONE_BIND:-}" ] && export RCLONE_BIND

# --- dead-man's-switch alerting (healthchecks.io or any ping URL) ---
# Set HEALTHCHECK_URL in backup.env. Pings on success; pings /fail on any error.
# If pings stop (cron dead, server dead, backup failing), the monitor emails you.
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"
ping_hc() { [ -n "$HEALTHCHECK_URL" ] && curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}${1:-}" >/dev/null 2>&1 || true; }
trap 'ping_hc /fail' ERR

PG_CONTAINER="${PG_CONTAINER:-stockez-postgres}"
DB_NAME="${DB_NAME:-stockez}"
DB_USER="${DB_USER:-stockez}"
R2_REMOTE="${R2_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:-stockez-backups}"
WORKDIR="${WORKDIR:-/opt/stockez/backups}"
KEEP_LOCAL="${KEEP_LOCAL:-12}"

mkdir -p "$WORKDIR"
TS=$(date +%Y%m%d-%H%M%S)
FILE="$WORKDIR/stockez_${TS}.sql.gz"

# 1) dump + gzip
docker exec "$PG_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
echo "[$(date)] dumped $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"

# 2) off-site to R2 (every run)
rclone copy "$FILE" "${R2_REMOTE}:${R2_BUCKET}/frequent/" --no-traverse

# 3) tiered copies for retention
MIN=$(date +%M); HHMM=$(date +%H%M)
[ "$MIN" = "00" ]     && rclone copy "$FILE" "${R2_REMOTE}:${R2_BUCKET}/hourly/" --no-traverse
[ "$HHMM" = "0200" ]  && rclone copy "$FILE" "${R2_REMOTE}:${R2_BUCKET}/daily/"  --no-traverse

# 4) prune local + each R2 tier
ls -1t "$WORKDIR"/*.gz 2>/dev/null | tail -n +$((KEEP_LOCAL+1)) | xargs -r rm -f
rclone delete "${R2_REMOTE}:${R2_BUCKET}/frequent/" --min-age 6h  2>/dev/null || true
rclone delete "${R2_REMOTE}:${R2_BUCKET}/hourly/"   --min-age 3d  2>/dev/null || true
rclone delete "${R2_REMOTE}:${R2_BUCKET}/daily/"    --min-age 60d 2>/dev/null || true

# 5) weekly product-image archive (Sun 02:30)
#    Never fatal: image problems must not fail the DB backup or trip
#    the healthcheck. Never deletes: `copy`, not `sync`.
IMAGES_ARCHIVE_ENABLED="${IMAGES_ARCHIVE_ENABLED:-true}"
IMAGES_BUCKET="${IMAGES_BUCKET:-stockez-images}"
IMAGES_ARCHIVE="${IMAGES_ARCHIVE:-images-archive}"

if [ "$IMAGES_ARCHIVE_ENABLED" = "true" ] \
   && [ "$(date +%u)" = "7" ] && [ "$HHMM" = "0230" ]; then
  {
    SRC_N=$(rclone ls "${R2_REMOTE}:${IMAGES_BUCKET}" 2>/dev/null | wc -l || echo 0)
    if [ "${SRC_N:-0}" -lt 1 ]; then
      # An empty listing means a broken token or an outage, not "no images".
      # Copying would be harmless, but refuse anyway so the log says why.
      echo "[$(date)] image archive SKIPPED — source listed 0 objects"
    else
      rclone copy "${R2_REMOTE}:${IMAGES_BUCKET}/" \
                  "${R2_REMOTE}:${R2_BUCKET}/${IMAGES_ARCHIVE}/" --no-traverse
      ARC_N=$(rclone ls "${R2_REMOTE}:${R2_BUCKET}/${IMAGES_ARCHIVE}/" 2>/dev/null | wc -l || echo 0)
      echo "[$(date)] image archive OK — live=${SRC_N} archived=${ARC_N}"
    fi
  } || echo "[$(date)] image archive FAILED (database backup unaffected)"
fi

ping_hc   # success — tells the monitor "backup ran OK just now"
echo "[$(date)] backup complete"
