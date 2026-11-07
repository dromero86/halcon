#!/usr/bin/env bash
# Ejecuta los gates de criterio_de_exito de T-044 Fase 2a.
# Uso: bash test/gates.sh
set -u

cd "$(dirname "$0")/.." || exit 1
fallos=0

gate() {
  local id="$1"
  shift
  echo "=== $id ==="
  echo "\$ $*"
  "$@"
  local rc=$?
  echo "exit=$rc"
  if [ "$rc" -ne 0 ]; then fallos=$((fallos + 1)); fi
  echo
}

gate package node -e "const p=require('./package.json'); if(p.type!=='module'||p.version!=='0.1.0'||p.dependencies||p.devDependencies) process.exit(1)"

gate import node --input-type=module -e "const m=await import('./sdk/src/halcon.js'); const req=['ui','create','define','kinds','init','register','VERSION']; const falta=req.filter(k=>!(k in m)); if(falta.length){console.error(falta);process.exit(1)}"

echo "=== sin-globals ==="
echo "\$ grep -l 'window\.|document\.' sdk/src/halcon.js sdk/src/version.js | wc -l"
n=$(grep -l "window\.\|document\." sdk/src/halcon.js sdk/src/version.js 2>/dev/null | wc -l)
echo "$n"
[ "$n" = "0" ] || fallos=$((fallos + 1))

echo "=== sin-globals (barrido del entry) ==="
echo "\$ grep -n 'window\.|document\.|globalThis' sdk/src/halcon.js sdk/src/version.js"
if grep -n "window\.\|document\.\|globalThis" sdk/src/halcon.js sdk/src/version.js; then
  fallos=$((fallos + 1))
else
  echo "sin coincidencias"
fi

echo
gate tests node --test test/

gate plugins node --input-type=module -e "const m=await import('./sdk/src/halcon.js'); const k=new Set(m.kinds()); for(const n of ['mainbar','formview','datalist']) if(!k.has(n)){console.error('falta '+n);process.exit(1)}"

echo "gates fallidos: $fallos"
exit "$fallos"
