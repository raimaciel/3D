#!/usr/bin/env bash
#
# Publica o Gestão 3D na Cloudflare. O passo a passo completo, com o que fazer
# no site da Cloudflare antes disto, está em PUBLICAR.md.
#
#   bash scripts/publicar.sh --simular    confere tudo sem publicar nada
#   bash scripts/publicar.sh              publica de verdade
#
set -euo pipefail
cd "$(dirname "$0")/.."

SIMULAR=0
[ "${1:-}" = "--simular" ] && SIMULAR=1

erro() { echo; echo "  ERRO: $1"; echo; exit 1; }
passo() { echo; echo "── $1"; }

# ---------------------------------------------------------------- configuração
[ -f .env ] || erro "Não achei o arquivo .env.
  Copie o modelo e preencha com os dados da sua conta Cloudflare:
      cp .env.exemplo .env
  Depois abra o .env e siga o PUBLICAR.md para obter cada valor."

set -a; . ./.env; set +a

for v in CF_WORKER_NAME CF_D1_NOME CF_D1_ID CF_R2_BUCKET; do
  [ -n "${!v:-}" ] || erro "Falta preencher $v no arquivo .env."
done
case "$CF_D1_ID" in
  cole-aqui*|"") erro "O CF_D1_ID ainda está com o texto de exemplo.
  Rode:  npx wrangler d1 create $CF_D1_NOME
  e copie o database_id que ele devolver para o .env." ;;
esac

echo "Publicando com esta configuração:"
echo "   Worker : $CF_WORKER_NAME"
echo "   Banco  : $CF_D1_NOME"
echo "   Arquivos: $CF_R2_BUCKET"
[ "$SIMULAR" = 1 ] && echo "   MODO SIMULAÇÃO: nada será enviado."

# ------------------------------------------------------------------- pré-checagem
passo "Conferindo se você está conectado à Cloudflare"
# Atenção: "wrangler whoami" sai com código 0 mesmo SEM login — ele só avisa
# no texto. Por isso a checagem olha a saída, e não o código de saída.
QUEM=$(npx wrangler whoami 2>&1 || true)
case "$QUEM" in
  *"not authenticated"*|*"não autenticado"*)
    erro "Você ainda não conectou este computador à sua conta Cloudflare.
  Rode:  npx wrangler login
  Vai abrir o navegador para você autorizar, e aí rode este script de novo." ;;
esac
echo "$QUEM" | grep -iE "associated with the email|account name|account id" | head -2 | sed 's/^/   /' || true

# ------------------------------------------------------------------------ testes
passo "Rodando os testes antes de publicar"
node --experimental-strip-types lib/precificacao.teste.ts | tail -1 | sed 's/^/   preço: /'
node --experimental-strip-types lib/auth.teste.ts        | tail -1 | sed 's/^/   login: /'
node --experimental-strip-types lib/arquivos.teste.ts    | tail -1 | sed 's/^/   arquivos: /'

# ------------------------------------------------------------------------- build
passo "Compilando"
pnpm build >/dev/null 2>&1 || erro "A compilação falhou. Rode 'pnpm build' para ver o motivo."
echo "   ok"

# --------------------------------------------------------------------- migrações
passo "Criando as tabelas no banco (só faz efeito na primeira vez)"
for m in drizzle/0000_small_solo.sql drizzle/0001_login.sql; do
  if [ "$SIMULAR" = 1 ]; then
    echo "   [simulação] aplicaria $m"
  else
    npx wrangler d1 execute "$CF_D1_NOME" --remote --file "$m" --yes >/dev/null 2>&1 \
      && echo "   aplicada: $m" \
      || echo "   já existia (ou falhou): $m"
  fi
done

# ------------------------------------------------------------------------ deploy
passo "Enviando o sistema"
if [ "$SIMULAR" = 1 ]; then
  npx wrangler deploy --config dist/server/wrangler.json --dry-run 2>&1 | tail -6 | sed 's/^/   /'
  echo
  echo "Simulação concluída. Para publicar de verdade, rode sem --simular."
  exit 0
fi
npx wrangler deploy --config dist/server/wrangler.json

cat <<'FIM'

──────────────────────────────────────────────────────────────
PUBLICADO. Agora, IMEDIATAMENTE:

  1. Abra o endereço que apareceu acima.
  2. Crie o primeiro acesso na tela que vai aparecer.

Faça isso agora, não depois. Enquanto ninguém criar esse acesso,
quem abrir o endereço pode criá-lo no seu lugar.

Se preferir fechar essa janela antes de publicar, veja a parte
do SETUP_TOKEN no PUBLICAR.md.
──────────────────────────────────────────────────────────────
FIM
