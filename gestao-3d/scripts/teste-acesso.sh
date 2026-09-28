#!/usr/bin/env bash
# Prova que a API está fechada. Rode com o sistema no ar:
#   pnpm build && pnpm start        (noutro terminal)
#   bash scripts/teste-acesso.sh http://127.0.0.1:8787
#
# Espera um banco com as duas migrações aplicadas. Não altera dados: só tenta,
# e confere que é recusado.
set -u
BASE="${1:-http://127.0.0.1:8787}"
TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
ok=0; falhou=0

# O servidor local da Cloudflare (wrangler dev), no Windows, responde 503
# "Your worker restarted mid-request" em uma de cada duas requisições POST cujo
# corpo o sistema recusa sem ler. É defeito do wrangler, não do sistema: a
# mensagem vem de uma camada que só existe no servidor local, e acontece igual
# com Node 22 e com Node 26. A própria mensagem pede para repetir, então só
# nesse caso exato o teste repete, e no máximo duas vezes.
testa() { # nome, código esperado, curl args...
  local nome="$1" esperado="$2"; shift 2
  local codigo tentativa
  for tentativa in 1 2 3; do
    codigo=$(curl -s -o "$TMP" -w '%{http_code}' --max-time 20 "$@")
    [ "$codigo" = 503 ] && grep -q 'restarted mid-request' "$TMP" || break
  done
  if [ "$codigo" = "$esperado" ]; then ok=$((ok+1)); printf '  ok    %-52s %s\n' "$nome" "$codigo"
  else falhou=$((falhou+1)); printf '  FALHA %-52s esperado %s, veio %s\n' "$nome" "$esperado" "$codigo"; fi
}

echo "Conferindo $BASE"
echo
echo "Sem sessão, tudo o que toca dados precisa ser recusado:"
testa "GET  /api/workspace"                401 "$BASE/api/workspace"
testa "POST /api/workspace sem Origin"     403 -X POST "$BASE/api/workspace" -H 'Content-Type: application/json' -d '{"revision":0,"action":{}}'
testa "POST /api/workspace com Origin"     401 -X POST "$BASE/api/workspace" -H "Origin: $BASE" -H 'Content-Type: application/json' -d '{"revision":0,"action":{}}'
testa "POST /api/files"                    401 -X POST "$BASE/api/files" -H "Origin: $BASE"
testa "GET  /api/files/<id>"               401 "$BASE/api/files/00000000-0000-4000-8000-000000000000"
testa "POST /api/auth/logout sem Origin"   403 -X POST "$BASE/api/auth/logout"
echo
echo "Só estas respondem sem sessão:"
testa "GET  /api/auth/me"                  200 "$BASE/api/auth/me"
echo
echo "Cookie de sessão inventado não vale:"
testa "GET  /api/workspace com token falso" 401 "$BASE/api/workspace" -H "Cookie: gestao3d_sessao=$(printf 'a%.0s' {1..64})"
testa "GET  /api/workspace com lixo"        401 "$BASE/api/workspace" -H 'Cookie: gestao3d_sessao=nao-e-token'
echo
echo "============================================================"
echo "$ok passaram, $falhou falharam"
[ "$falhou" -eq 0 ]
