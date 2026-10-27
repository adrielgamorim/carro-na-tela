# TODO — Carro na tela

Pendências por área, com prioridade (🔴 alta, 🟡 média, 🟢 baixa). O que já foi feito está em
[Concluído](#concluído), no fim. Antes de integrar uma fonte nova, confira os termos de uso e a
disponibilidade dela.

## A fazer

### Publicação e infraestrutura

- [ ] 🔴 Criar o repositório remoto (GitHub) e enviar o `main`. Hoje o git é só local.
- [ ] 🔴 CI (GitHub Actions): lint, `tsc -b`, testes e build em cada push.
- [ ] 🔴 Publicar o site (Cloudflare Pages, por exemplo) e o Worker do proxy numa rota do domínio,
      gerando o build com `VITE_FIPE_API_URL`.
- [ ] 🟡 Levar o `npm run daily` para fora do Windows (GitHub Action agendada ou servidor), com o
      índice publicado a cada execução. Hoje depende do PC ligado às 03:00.
- [ ] 🟡 Proxy sem chave: ele usa `FIPE_PROXY_TOKEN` ou `FIPE_TOKEN`, mas o `.env` só tem
      `FIPE_TOKEN1..6`, então o site consulta a FIPE como anônimo (500/dia). Aceitar as chaves
      numeradas, com rodízio, ou definir uma chave própria para o proxy.

### Dados

- [ ] 🔴 Completar os preços (25% hoje; semanas de varredura). A listagem já está completa: as 28
      marcas da FIPE que faltam não têm modelo de 2009 em diante.
- [ ] 🟡 Melhorar a cobertura de fotos: 732 de 5.021 versões não casam com o Wikidata (Land Rover
      137, BMW 102, Iveco 58, Citroën 45) e 62 casam com modelos sem foto.
- [ ] 🟡 Catálogo como aba inicial quando a cobertura de preços for boa.
- [ ] 🟡 Atualizar todo ano as alíquotas de IPVA e os preços padrão de combustível
      (`src/catalog/costs.ts`, hoje out/2026) e ler o PBEV 2027 quando sair.
- [ ] 🟢 Fase 4 do plano: potência, torque, dimensões, porta-malas, peso e equipamentos não têm
      fonte gratuita confiável; só por curadoria manual ou comunitária.
- [ ] 🟢 Avaliar APIs pagas de consulta por placa (exige backend e atenção à LGPD).

### Produto

- [ ] 🟢 Motos e caminhões no catálogo (o crawler já aceita `--category`; filtros e WMI precisam
      de ajuste).

### Desempenho

- [ ] 🟢 Web Worker para expandir e filtrar o índice: medido em out/2026, não compensa ainda
      (expandir 30 ms; filtrar + contar facetas + agrupar 18–60 ms com 17.754 versões-ano).
      Medir de novo quando entrarem motos e caminhões.
- [ ] 🟢 Chunk principal (292 KB, 92 KB com gzip) é quase todo React DOM; só mexer se aparecer
      algo pesado.

### Qualidade de código

- [ ] 🟡 Teste de ponta a ponta (Playwright) dos fluxos principais: consulta → comparar, filtros do
      catálogo na URL, recarregar, busca pelo chassi. `CatalogPage` ainda não tem teste de
      componente.
- [ ] 🟢 Roteamento feito à mão (`?view=`, `pushState`, parâmetros por aba): suficiente para duas
      abas. Se vierem páginas novas (detalhe com URL, páginas por marca), adotar um roteador.
- [ ] 🟢 Ligar `noUncheckedIndexedAccess` no TypeScript (84 erros hoje).

## Concluído

Histórico resumido, em ordem aproximada.

**Base e arquitetura**

- [x] Aviso "Catálogo em construção" e o selo "80 de 108 marcas" mostravam a listagem como
      incompleta, comparando com marcas que a FIPE só tem antes de 2009. Agora dependem só de
      `listingComplete`.

- [x] Repositório git local (`main`), com tudo versionado menos o que o `.gitignore` exclui (`.env`,
      `node_modules`, `.cache`, `dist`, `logs`): `data/` (45 MB, PDFs do INMETRO) e
      `public/catalog/` entram, porque o maior arquivo tem 6,4 MB e o índice publicado precisa deles.

- [x] README e limpeza do template do Vite.
- [x] `App.tsx` (~1.200 linhas) quebrado em hooks e componentes; `useFipeCatalog` com
      `useReducer` (transições puras) e testes da cascata.
- [x] Cliente HTTP único com erro tipado, timeout, `AbortSignal` e cache compartilhado.
- [x] Erro por etapa na Consulta, com "Tentar novamente" só do que falhou.
- [x] Camada de providers (`{ source, confidence, data }`) e `enrichment.ts`.
- [x] Proxy da FIPE (`/api/fipe`): chave só no servidor, rotas permitidas, CORS e cache por mês, no
      Vite e no Cloudflare Worker.
- [x] Consultas e comparador salvos no `localStorage`.
- [x] Cada aba guarda só os próprios parâmetros na URL (corrigiu a consulta que "grudava" no
      catálogo e voltava ao recarregar).

**Desempenho**

- [x] Índice fatiado por categoria e marca (`public/catalog/marcas/`, 80 arquivos, o maior com
      252 KB / 23 KB gzip): a Consulta carrega só a fatia da marca do veículo para os detalhes e o
      comparador, em vez dos 3 MB (297 KB gzip) do índice inteiro, que reaproveita quando já está
      em memória.
- [x] `React.lazy`: aba Catálogo (JS e CSS) e tabela comparativa em chunks próprios; o Catálogo
      começa a baixar quando o mouse passa no link. Chunk principal: 330 → 292 KB (101 → 92 KB
      gzip). Os nomes dos parâmetros de URL do catálogo foram separados (`catalogParams.ts`) para
      não puxar os filtros para o chunk principal; o estilo da tabela comparativa foi para
      `compareTable.css`, que ela mesma importa.

**Produto**

- [x] Filtro de procedência (nacional/importado): pela parcela da frota da linha registrada como
      importada no Renavam (`I/`, `IMP/`). Linhas feitas na Argentina ou no México (Hilux,
      Cronos, 208) contam como importadas.
- [x] Depreciação média da versão nos detalhes ("6,5% ao ano (2023 → 2027)"), pelos preços FIPE
      dos anos-modelo da versão no mesmo mês (sem o 0 km).
- [x] Modo escuro pelo sistema (`prefers-color-scheme`): as ~125 cores fixas do CSS viraram
      tokens em `src/index.css`, com valores claros e escuros.
- [x] Frota por estado: o `fetch:frota` soma também por UF, e o índice guarda o total e a
      posição de cada linha em cada estado (+200 KB). Os detalhes mostram o estado das premissas
      ("Em SP: 243.500 veículos · 25º mais comum").
- [x] Detalhe do catálogo com URL própria (`?versao=<id>`): o link abre a versão direto; fechar
      limpa o parâmetro.

**Desempenho (continuação)**

- [x] Busca por texto no catálogo 13× mais rápida (794 → 61 ms por tecla na primeira busca, ~27 ms
      nas seguintes): o texto normalizado de cada versão e o da busca são calculados uma vez só, em
      vez de a cada versão em cada faceta.
- [x] Service worker (`public/sw.js`, só no build de produção) e manifesto PWA: assets com hash
      em cache primeiro; página e JSONs do catálogo pela rede primeiro, com o cache para abrir sem
      internet; o proxy da FIPE fica de fora. Testado com o servidor desligado.

**Qualidade de código**

- [x] `CatalogPage.tsx` de 576 para 375 linhas: chips de filtros ativos em `src/catalog/activeChips.ts`
      (função pura, com teste), cabeçalho e aviso de cobertura em `CatalogHeading.tsx` e preço ao
      vivo dos cards no hook `useLivePrices`.
- [x] `useFipeCatalog.ts` de 540 para 188 linhas: estado, ações e reducer puro da cascata em
      `src/hooks/fipeCatalogState.ts`; o hook fica só com as requisições.
- [x] `CatalogFilterPanel.tsx` de 486 para 350 linhas: `CheckList` e `ChipGroup` em
      `facetControls.tsx`, rótulos e helpers de valor em `facetValues.ts`.
- [x] CSS por componente: cada componente importa o seu `.css` (19 arquivos novos). Ficam globais
      só as regras compartilhadas: `App.css` de ~1.800 para 587 linhas, `catalog.css` de ~1.000 para 142.
      Conferido pelo DOM (valor calculado de cada regra movida) nas duas abas, no detalhe, na
      bandeja do comparador e no celular.
- [x] Testes de componente do `VinSearch` (envio, erro, resultado, filtros aplicados, limpar).

**Robustez**

- [x] Error boundary por aba (`src/components/ErrorBoundary.tsx`): um erro de renderização mostra
      a mensagem com "Tentar novamente" em vez de deixar a página em branco; o cabeçalho e a outra
      aba continuam funcionando.

**Consulta FIPE**

- [x] Busca por código FIPE (com ou sem hífen; tenta as três categorias).
- [x] Seleção na URL e "Copiar link da consulta".
- [x] 0 km (ano 32000) em toda a interface.
- [x] Família/linha com prefixos de duas palavras ("Grand Siena", "Range Rover", "Classe C").
- [x] Sparkline do histórico de preços.

**Catálogo** ([plano](docs/PLANO-CATALOGO.md))

- [x] Atributos a partir do nome FIPE (`parseModelName`).
- [x] Crawler com cache em disco, retomada, listagem separada dos preços, prioridade de preços
      (0 km e anos recentes), rodízio de chaves (`FIPE_TOKEN`, `FIPE_TOKEN1…`) e "Consultar preço"
      ao vivo.
- [x] Índice compacto v2 e página Catálogo com facetas, busca nas listas, cilindrada e portas.
- [x] Detalhes do item (ficha, IPVA, custo/km, sparkline, histórico) e comparador em tabela.
- [x] Reserva do crawler só na última chave (em geral o acesso anônimo, que o proxy do site
      divide): as outras são usadas até zerar, recuperando ~100 requisições/dia com 6 chaves.
- [x] Wikidata e WMI atualizados pelo daily quando os arquivos passam de 30 dias.
- [x] Execução diária (`npm run daily`) agendada no Windows (`schedule:daily` / `unschedule:daily`).

**Custos**

- [x] IPVA por estado (alíquotas 2026; faixa quando depende da potência).
- [x] Custo por km com premissas editáveis (UF e preços).

**Fontes de dados**

- [x] INMETRO PBEV 2010–2026: parser por layout de ano, casamento por ano-modelo (~3.000 versões),
      ajustes manuais, filtros de porte, marchas, consumo, direção e ar.
- [x] ANP: preço médio por estado, semanal, no custo por km.
- [x] Wikidata / Commons: foto e descrição da linha (4.289 versões, 562 modelos).
- [x] Chassi (VIN): WMI da Wikipedia (1.536 códigos), ano pelo 10º caractere e NHTSA vPIC.
- [x] Senatran: frota em circulação por linha (4.750 versões em 677 linhas), ordenação "Mais comuns
      na frota", que intercala as linhas (a versão mais nova de cada uma, depois a segunda…)
      para a primeira página não ser só de Gol.
