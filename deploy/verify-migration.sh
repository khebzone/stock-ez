#!/usr/bin/env bash
# ============================================================
#  Verifies a migration moved EVERYTHING — data and images.
#
#  Run the same command on BOTH servers and diff the output.
#
#    bash verify-migration.sh fingerprint > old.txt   # on OLD
#    bash verify-migration.sh fingerprint > new.txt   # on NEW
#    diff old.txt new.txt
#
#  Subcommands:
#    fingerprint   row counts + sequences + image counts (diff-able)
#    images        classify every image URL and HTTP-check it resolves
#    uploads       inspect the LOCAL uploads volume (not covered by backups)
#
#  Read-only throughout.
# ============================================================
set -uo pipefail

PG_CONTAINER="${PG_CONTAINER:-stockez-postgres}"
API_CONTAINER="${API_CONTAINER:-stockez-api}"
DB_NAME="${DB_NAME:-stockez}"
DB_USER="${DB_USER:-stockez}"

psql_q() { docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -At -F'|' -c "$1" 2>/dev/null; }

# Every image column in the schema.
IMG_COLS="products:image_url customers:owner_image_url customers:shop_image_url users:profile_image_url"

img_union() {
  echo "SELECT image_url FROM products WHERE image_url IS NOT NULL
        UNION ALL SELECT owner_image_url   FROM customers WHERE owner_image_url IS NOT NULL
        UNION ALL SELECT shop_image_url    FROM customers WHERE shop_image_url IS NOT NULL
        UNION ALL SELECT profile_image_url FROM users     WHERE profile_image_url IS NOT NULL"
}

cmd_fingerprint() {
  echo "### ROW COUNTS"
  psql_q "SELECT relname,
      (xpath('/row/c/text()', query_to_xml(
         format('SELECT count(*) AS c FROM %I.%I', schemaname, relname),
         false, true, '')))[1]::text::bigint
    FROM pg_stat_user_tables ORDER BY relname;"

  echo
  echo "### SEQUENCES (must carry over, or new inserts collide)"
  psql_q "SELECT sequencename, last_value FROM pg_sequences
          WHERE schemaname='public' ORDER BY sequencename;"

  echo
  echo "### IMAGE COUNTS PER COLUMN"
  for pair in $IMG_COLS; do
    t="${pair%%:*}"; c="${pair##*:}"
    n=$(psql_q "SELECT count(*) FROM $t WHERE $c IS NOT NULL;")
    echo "${t}.${c}|${n:-ERR}"
  done

  echo
  echo "### IMAGE URLS BY HOST"
  psql_q "SELECT split_part(split_part(u,'://',2),'/',1) AS host, count(*)
          FROM ($(img_union)) x(u) GROUP BY 1 ORDER BY 2 DESC;"

  echo
  echo "### DISTINCT IMAGE URLS"
  psql_q "SELECT count(DISTINCT u) FROM ($(img_union)) x(u);"
}

cmd_uploads() {
  echo "=== LOCAL uploads volume ==="
  echo "backup.sh only runs pg_dump. Anything here is NOT in your backups"
  echo "and will NOT move unless you copy the volume explicitly."
  echo
  if ! docker exec "$API_CONTAINER" sh -c 'test -d /app/uploads' 2>/dev/null; then
    echo "  /app/uploads does not exist in $API_CONTAINER — nothing to move."
    return
  fi
  N=$(docker exec "$API_CONTAINER" sh -c 'find /app/uploads -type f 2>/dev/null | wc -l' | tr -d ' ')
  SZ=$(docker exec "$API_CONTAINER" sh -c 'du -sh /app/uploads 2>/dev/null | cut -f1')
  echo "  files: ${N:-0}"
  echo "  size : ${SZ:-0}"
  if [ "${N:-0}" -gt 0 ]; then
    echo
    echo "  ⚠  NON-EMPTY. These are legacy pre-R2 images. Copy the volume:"
    echo "     docker run --rm -v stockez_uploads:/v -v \$PWD:/b alpine \\"
    echo "       tar czf /b/uploads.tar.gz -C /v ."
    echo "     scp -O uploads.tar.gz <new-host>:~/"
    echo "     docker run --rm -v stockez_uploads:/v -v \$PWD:/b alpine \\"
    echo "       tar xzf /b/uploads.tar.gz -C /v"
    echo
    docker exec "$API_CONTAINER" sh -c 'find /app/uploads -type f 2>/dev/null | head -10'
  else
    echo "  Empty — all images are in R2. Nothing to move."
  fi
}

cmd_images() {
  echo "=== Image reachability ==="
  TMP=$(mktemp); trap 'rm -f "$TMP"' RETURN
  psql_q "SELECT DISTINCT u FROM ($(img_union)) x(u) ORDER BY 1;" > "$TMP"
  TOTAL=$(wc -l < "$TMP" | tr -d ' ')
  echo "Distinct image URLs referenced in the database: $TOTAL"
  echo

  LOCAL=$(grep -c '/uploads/' "$TMP" || true)
  if [ "$LOCAL" -gt 0 ]; then
    echo "⚠  $LOCAL URLs point at LOCAL /uploads/ — these need the volume copied."
    echo "   Run: bash verify-migration.sh uploads"
    echo
  fi

  echo "Checking each URL (HEAD)..."
  OK=0; BAD=0
  while IFS= read -r url; do
    [ -z "$url" ] && continue
    code=$(curl -s -o /dev/null -w '%{http_code}' -I -m 15 "$url" 2>/dev/null)
    if [ "$code" = "200" ]; then
      OK=$((OK+1))
    else
      BAD=$((BAD+1))
      echo "  BROKEN [$code] $url"
    fi
  done < "$TMP"

  echo
  echo "reachable : $OK / $TOTAL"
  echo "broken    : $BAD"
  [ "$BAD" -eq 0 ] && echo "=== ALL IMAGES OK ===" || echo "=== $BAD BROKEN — do not enable orphan cleanup ==="
}

case "${1:-}" in
  fingerprint) cmd_fingerprint ;;
  images)      cmd_images ;;
  uploads)     cmd_uploads ;;
  *) echo "usage: $0 {fingerprint|images|uploads}"; exit 1 ;;
esac
