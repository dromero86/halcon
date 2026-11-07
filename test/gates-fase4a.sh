#!/usr/bin/env bash
# Ejecuta los gates de criterio_de_exito de T-044 Fase 4a.
# Uso: bash test/gates-fase4a.sh
set -u

cd "$(dirname "$0")/.." || exit 1
fallos=0

gate() {
  local id="$1"
  shift
  echo "=== $id ==="
  "$@"
  local rc=$?
  echo "exit=$rc"
  if [ "$rc" -ne 0 ]; then fallos=$((fallos + 1)); fi
  echo
}

gate tests node --test test/
gate lint node scripts/lint.mjs
gate compat node scripts/compat.mjs

gate mock-arranca node --input-type=module -e "const {start}=await import('./mock/server.mjs');
    const s=await start({port:0}); const r=await fetch(s.url+'/api/clientes'); await s.close(); process.exit(r.status===401?0:1)"

echo "=== sin-webix ==="
n=$(grep -l "webix" mock/server.mjs sdk/src/auth/session.js sdk/src/auth/pkce.js 2>/dev/null | wc -l)
echo "$n"
[ "$n" = "0" ] || fallos=$((fallos + 1))

echo "gates fallidos: $fallos"
exit "$fallos"
