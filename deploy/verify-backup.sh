#!/usr/bin/env bash
# ============================================================
#  StockEz restore drill — proves the latest backup actually
#  restores, WITHOUT touching production.
#
#  Spins up a throwaway Postgres container, loads the newest
#  backup into it, compares row counts table-by-table against
#  the live database, and prints your real recovery time.
#
#  Production is only ever READ. Nothing here can modify it.
#
#  Usage:
#     bash verify-backup.sh                     # newest from R2
#     bash verify-backup.sh /path/to/x.sql.gz   # a specific file
# ============================================================
set -euo pipefail

CFG=/opt/stockez/backup.env
[ -f "$CFG" ] && source "$CFG"

# See backup.sh — hosts with IPv6 need rclone bound to the v4 address
# because the R2 token is IP-filtered.
[ -n "${RCLONE_BIND:-}" ] && export RCLONE_BIND

PG_CONTAINER="${PG_CONTAINER:-stockez-postgres}"
DB_NAME="${DB_NAME:-stockez}"
DB_USER="${DB_USER:-stockez}"
R2_REMOTE="${R2_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:-stockez-backups}"

DRILL="stockez-restore-drill"
WORK=$(mktemp -d)

cleanup() {
  docker rm -f "$DRILL" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# Exact per-table row counts, works without knowing the schema.
COUNTS_SQL="SELECT relname,
  (xpath('/row/c/text()', query_to_xml(
     format('SELECT count(*) AS c FROM %I.%I', schemaname, relname),
     false, true, '')))[1]::text::bigint AS n
  FROM pg_stat_user_tables ORDER BY relname;"

echo "=== StockEz restore drill ==="

# ---- 1. pick the backup ----------------------------------------------------
if [ $# -ge 1 ]; then
  FILE="$1"
  [ -f "$FILE" ] || { echo "no such file: $FILE"; exit 1; }
  echo "Using local file: $FILE"
else
  echo "Fetching newest backup from ${R2_REMOTE}:${R2_BUCKET}/frequent/ ..."
  rclone copy "${R2_REMOTE}:${R2_BUCKET}/frequent/" "$WORK/" \
    --include 'stockez_*.sql.gz' --max-age 24h --no-traverse
  FILE=$(ls -1t "$WORK"/stockez_*.sql.gz 2>/dev/null | head -1 || true)
  [ -n "$FILE" ] || { echo "FAIL: no backup newer than 24h found in R2"; exit 1; }
  echo "Using: $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"
fi

# Integrity of the gzip itself, before anything else.
gunzip -t "$FILE" || { echo "FAIL: $FILE is a corrupt gzip"; exit 1; }
echo "gzip integrity OK"

# ---- 2. throwaway Postgres, same image as production -----------------------
PG_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$PG_CONTAINER" 2>/dev/null || echo "postgres:15-alpine")
echo "Starting drill container ($PG_IMAGE) ..."
docker run -d --name "$DRILL" \
  -e POSTGRES_DB="$DB_NAME" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="drill-$(date +%s)" \
  "$PG_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  docker exec "$DRILL" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$DRILL" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null \
  || { echo "FAIL: drill container never became ready"; exit 1; }

# ---- 3. restore, timed -----------------------------------------------------
echo "Restoring ... (this is your recovery time)"
START=$(date +%s)
if ! gunzip -c "$FILE" | docker exec -i "$DRILL" psql -v ON_ERROR_STOP=1 -q \
       -U "$DB_USER" -d "$DB_NAME" > "$WORK/restore.log" 2>&1; then
  echo "FAIL: restore errored. Last 20 lines:"
  tail -20 "$WORK/restore.log"
  exit 1
fi
ELAPSED=$(( $(date +%s) - START ))
echo "Restore completed in ${ELAPSED}s"

# ---- 4. compare against live ----------------------------------------------
docker exec "$DRILL" psql -U "$DB_USER" -d "$DB_NAME" -At -F'|' -c "$COUNTS_SQL" \
  | sort > "$WORK/restored.txt"
docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -At -F'|' -c "$COUNTS_SQL" \
  | sort > "$WORK/live.txt"

RESTORED_TABLES=$(wc -l < "$WORK/restored.txt")
RESTORED_ROWS=$(awk -F'|' '{s+=$2} END {print s+0}' "$WORK/restored.txt")

echo
echo "Tables restored : $RESTORED_TABLES"
echo "Rows restored   : $RESTORED_ROWS"
echo

if [ "$RESTORED_TABLES" -eq 0 ]; then
  echo "FAIL: backup restored zero tables. This backup is worthless."
  exit 1
fi

echo "--- tables differing from live (drift since the dump is normal) ---"
if diff "$WORK/live.txt" "$WORK/restored.txt" > "$WORK/diff.txt"; then
  echo "(none — identical to live)"
else
  join -t'|' -j1 "$WORK/live.txt" "$WORK/restored.txt" 2>/dev/null \
    | awk -F'|' '$2 != $3 { printf "  %-32s live=%-10s restored=%-10s delta=%s\n", $1, $2, $3, $2-$3 }'
  echo
  echo "--- tables present in only one side (INVESTIGATE) ---"
  comm -3 <(cut -d'|' -f1 "$WORK/live.txt") <(cut -d'|' -f1 "$WORK/restored.txt") \
    | sed 's/^/  /' | grep -v '^\s*$' || echo "  (none)"
fi

echo
echo "=== DRILL PASSED ==="
echo "Recovery time from a cold backup: ${ELAPSED}s"
echo "Production database was not modified."
