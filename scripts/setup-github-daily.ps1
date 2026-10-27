# Prepara o GitHub para a "Atualização diária" (.github/workflows/daily.yml).
# Rode uma vez, na raiz do projeto, com o gh logado:
#
#   powershell -ExecutionPolicy Bypass -File scripts/setup-github-daily.ps1
#
# 1. Grava as chaves FIPE_TOKEN* do .env como segredos do repositório (os
#    valores vão direto do arquivo para o gh; nada é exibido).
# 2. Publica o cache local da FIPE (.cache/fipe, só respostas públicas da API)
#    na release "cache-semente", de onde a Action parte na primeira execução.
# 3. Troca a proteção clássica do main por um ruleset com as mesmas regras
#    (exigir o check "check", bloquear force push e exclusão) e duas exceções:
#    a GitHub Actions, para publicar os dados, e o administrador do repositório.

$ErrorActionPreference = "Stop"
$repo = "adrielgamorim/carro-na-tela"
$gh = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $gh) { $gh = "C:\Program Files\GitHub CLI\gh.exe" }

# 1. Segredos
foreach ($line in Get-Content .env) {
  if ($line -match '^(FIPE_TOKEN\d*)=(.+)$') {
    $name = $Matches[1]
    $Matches[2].Trim() | & $gh secret set $name --repo $repo
    if ($LASTEXITCODE -ne 0) { throw "Falha ao gravar $name" }
  }
}
& $gh secret list --repo $repo

# 2. Semente do cache
$seed = Join-Path $env:TEMP "fipe-cache.tar.gz"
tar -czf $seed -C .cache fipe
& $gh release create cache-semente $seed --repo $repo --prerelease `
  --title "Semente do cache da FIPE" `
  --notes "Respostas da API FIPE (dados públicos) usadas pela Atualização diária quando o cache do Actions está vazio. Não é uma versão do app."
if ($LASTEXITCODE -ne 0) { throw "Falha ao criar a release" }
Remove-Item $seed

# 3. Ruleset do main (15368 = GitHub Actions; 5 = papel de administrador)
$ruleset = @'
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
'@
$file = Join-Path $env:TEMP "ruleset-main.json"
[System.IO.File]::WriteAllText($file, $ruleset)
& $gh api -X POST "repos/$repo/rulesets" --input $file | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Falha ao criar o ruleset" }
Remove-Item $file
& $gh api -X DELETE "repos/$repo/branches/main/protection"
Write-Host "Pronto: segredos, semente do cache e ruleset do main configurados."
