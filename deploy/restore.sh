#!/usr/bin/env bash
# ============================================================
#  StockEz restore — loads a backup into Postgres.
#
#  Usage:
#     # from a local backup on the server:
#     bash restore.sh /opt/stockez/backups/stockez_YYYYMMDD-HHMMSS.sql.gz
#
#     # or pull the latest from R2 first:
#     rclone copy r2:stockez-backups/frequent/ /tmp/r/ --max-age 1h
#     bash restore.sh /tmp/r/stockez_*.sql.gz
# ============================================================
set -euo pipefail

CFG=/opt/stockez/backup.env
[ -f "$CFG" ] && source "$CFG"
PG_CONTAINER="${PG_CONTAINER:-stockez-postgres}"
DB_NAME="${DB_NAME:-stockez}"
DB_USER="${DB_USER:-stockez}"

FILE="${1:?usage: restore.sh <file.sql.gz>}"
echo "Restoring $FILE into database '$DB_NAME' ..."
read -r -p "This OVERWRITES current data. Type 'yes' to continue: " ok
[ "$ok" = "yes" ] || { echo "aborted"; exit 1; }

gunzip -c "$FILE" | docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"

echo "Restore complete."
