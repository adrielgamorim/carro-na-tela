#!/usr/bin/env bash
# Prepara o GitHub para a "Atualização diária" (.github/workflows/daily.yml).
# Rode na raiz do projeto, com o gh logado (pode rodar de novo sem problema):
#
#   bash scripts/setup-github-daily.sh
#
# 1. Grava as chaves FIPE_TOKEN* do .env como segredos do repositório (os
#    valores vão direto do arquivo para o gh; nada é exibido).
# 2. Publica o cache local da FIPE (.cache/fipe, só respostas públicas da API)
#    na release "cache-semente", de onde a Action parte na primeira execução.
# 3. Troca a proteção clássica do main por um ruleset com as mesmas regras
#    (exigir o check "check", bloquear force push e exclusão) e duas exceções:
#    a GitHub Actions, para publicar os dados, e o administrador do repositório.

set -euo pipefail
repo="adrielgamorim/carro-na-tela"
gh=$(command -v gh || echo "/c/Program Files/GitHub CLI/gh.exe")

# 1. Segredos
while IFS= read -r line || [ -n "$line" ]; do
  line=${line%$'\r'}
  name=${line%%=*}
  value=${line#*=}
  [[ $name =~ ^FIPE_TOKEN[0-9]*$ && -n $value ]] || continue
  printf '%s' "$value" | "$gh" secret set "$name" --repo "$repo"
done < .env
"$gh" secret list --repo "$repo"

# 2. Semente do cache
seed="${TMPDIR:-/tmp}/fipe-cache.tar.gz"
tar -czf "$seed" -C .cache fipe
if "$gh" release view cache-semente --repo "$repo" > /dev/null 2>&1; then
  "$gh" release upload cache-semente "$seed" --repo "$repo" --clobber
else
  "$gh" release create cache-semente "$seed" --repo "$repo" --prerelease \
    --title "Semente do cache da FIPE" \
    --notes "Respostas da API FIPE (dados públicos) usadas pela Atualização diária quando o cache do Actions está vazio. Não é uma versão do app."
fi
rm -f "$seed"

# 3. Ruleset do main (15368 = GitHub Actions; 5 = papel de administrador)
if "$gh" api "repos/$repo/rulesets" --jq '.[].name' | grep -qx main; then
  echo "Ruleset main já existe."
else
  "$gh" api -X POST "repos/$repo/rulesets" --input - > /dev/null <<'JSON'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 15368, "actor_type": "Integration", "bypass_mode": "always" },
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [{ "context": "check", "integration_id": 15368 }]
      }
    }
  ]
}
JSON
  echo "Ruleset main criado."
fi
if "$gh" api "repos/$repo/branches/main/protection" > /dev/null 2>&1; then
  "$gh" api -X DELETE "repos/$repo/branches/main/protection"
  echo "Proteção clássica do main removida (o ruleset a substitui)."
fi
echo "Pronto: segredos, semente do cache e ruleset do main configurados."
