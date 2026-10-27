# Segurança

Encontrou uma vulnerabilidade? Não abra uma issue pública: use **Security → Report a
vulnerability** neste repositório (relato privado).

As chaves da API FIPE ficam só no `.env` local e nos segredos do Cloudflare Worker; nunca no
repositório nem em variáveis `VITE_*`, que vão para o navegador.
