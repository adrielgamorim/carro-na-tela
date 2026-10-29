# TODO — Carro na tela

Pendências por área, com prioridade (🔴 alta, 🟡 média, 🟢 baixa). O que já foi feito está em
[Concluído](#concluído), no fim. Antes de integrar uma fonte nova, confira os termos de uso e a
disponibilidade dela.

## A fazer

### Publicação e infraestrutura

- [ ] 🔴 Completar a varredura dos anos antigos: a listagem agora desce até 1985 (os preços de 2009
      em diante estão em 98%). Quando terminar, rodar `fetch:wikidata`, `fetch:galeria` e
      `build:catalog` para os modelos novos.
- [ ] 🟡 Atualizar todo ano as alíquotas de IPVA e os preços padrão de combustível
      (`src/catalog/costs.ts`, hoje out/2026) e ler o PBEV 2027 quando sair.
- [ ] 🟢 Fotos que ainda faltam: 104 versões, quase todas utilitários e marcas de nicho sem artigo
      com foto (Hitech Electric Delivery/e.co, Effa, Foton Minitruck, Shineray, Wake, buggies), além
      de RAM Dakota (o artigo "Ram Dakota" é o antigo Dodge), JAC iEV e E-J*, Jetour S06 e Seres 3/5
      (a reserva é por linha, e a FIPE chama as duas só de "SERES").
- [ ] 🟢 Fase 4, o que falta: fichas de outras marcas e equipamentos por versão. VW e Renault já
      entram (`fichas:vw`, `fichas:renault`, `fichas:abertas`), mas as da VW são de 2017–2020 e o
      menu público só tem os modelos atuais. Equipamentos por versão: só as listas da Renault
      (Kardian, Logan, Sandero, Sandero R.S., Stepway); faltam os folhetos em PDF da Renault
      (`brochure` em `data/fichas/renault-links.json`) e os releases das outras marcas.
      Revisar `npm run extract:imprensa` de vez em quando para os releases novos.

### Fontes de dados a explorar

Fontes públicas encontradas em out/2026 e ainda não usadas. Ver os termos de uso de cada uma antes.

- [ ] 🟡 Wayback Machine (web.archive.org): guarda arquivos que sumiram dos sites das marcas.
      `npm run fichas:wayback -- --site=<domínio/caminho> --pasta=<nome>` baixa os PDFs salvos.
      Toyota feita (59 PDFs de 2018–2025, lidos por `scripts/fichas/toyota.ts`); faltam as listas
      sem marcas (Yaris 2020 e 2023, Camry 2023, RAV4 2020). Outras marcas (out/2026): vw.com.br
      tem ~30 PDFs distintos (suplementos de manual de Taos e Jetta, fichas de 2004–2016; pouco);
      ford.com.br tem 79 antigos (`binario.asp`, ~2010). Hyundai feita (catálogos por versão de
      HB20, HB20S, Creta, Kona… de 2024–2026, lidos por `scripts/fichas/hyundai.ts`); faltam as
      tabelas `ficha-tecnica-equipamentos-…` do Creta 25/26 (várias versões lado a lado) e os PDFs
      danificados no arquivo. Falta honda.com.br (78: catálogos de City, HR-V, WR-V, Fit, CR-V,
      Civic de 2015–2025), que pede um leitor próprio.
      Nissan e Chevrolet: o arquivo estava fora do ar; repetir.
- [ ] 🟡 Manuais do proprietário (PDF nos sites das marcas): o capítulo de dados técnicos tem
      medidas, pesos, capacidades e motor por versão, e cobre anos antigos.
- [ ] 🟡 Folhetos e catálogos em PDF: os da Renault estão em `brochure` de
      `data/fichas/renault-links.json`; dão equipamentos por versão de Duster, Kwid, Captur, Oroch…
      Os recentes terminam com "ficha técnica | lista de equipamentos" lado a lado na mesma página
      (as linhas das duas tabelas se intercalam): separar por posição antes de ler, como na Toyota.
- [ ] 🟢 Páginas de "ficha técnica"/"especificações" nos sites das marcas (fora a Stellantis, que
      tem Akamai): conferir robots.txt e o bloqueio de cada uma.
- [ ] 🟢 Releases com equipamentos em texto (VW: `news/json/news/{id}` da API aberta; Renault:
      `releases` de cada veículo na API; Stellantis já em cache): extrair itens por versão exige
      revisão à mão, como os dados de porta-malas e torque.
- [ ] 🟢 Recalls: sem fonte aberta por modelo (out/2026). O conjunto "Campanhas de Recall" da Senatran
      (dados.transportes.gov.br, `recall`) só tem o total do ano; a consulta oficial é por placa
      ou chassi, com login gov.br. Ver de novo se a Senacon publicar a lista de campanhas.
- [ ] 🟢 Roubos e furtos por modelo (SSP-SP): o AUTOSEG já dá os roubos por mil carros segurados.
      A transparência da SSP-SP (`transparenciassp/Consulta.aspx`) só tem boletins um a um, com
      endereço, por mês e departamento, num formulário ASP.NET; somar por modelo daria muito
      trabalho por pouco além do AUTOSEG.
- [ ] 🟢 Revisões com preço fixo (sites das marcas): custo das revisões por modelo, para o custo
      por km. Não há tabela aberta (out/2026): os sites das marcas consultam por modelo e CEP dentro
      dos seus apps, e as tabelas que aparecem são de reportagens antigas.
- [ ] 🟢 Flickr pela Openverse (a API do Flickr não dá chave a contas grátis): `npm run fetch:openverse`
      estava fora do ar (504); repetir. Mais fotos por ângulo,
      muitas de salões do automóvel no Brasil.
- [ ] 🟢 Fotos de imprensa (VW: 27 por versão; Renault: 782 listadas; Toyota): só com permissão
      das assessorias (contatos nas salas de imprensa).
- Bloqueadas ou sem arquivos: Toyota (download automático bloqueado), Chevrolet (sala de imprensa
  com login), Ford e Mitsubishi (só notícias; Hyundai só pelo Wayback). Pagas: JATO (Carspecs), Suiv.

### Produto

- [ ] 🟢 Motos e caminhões no catálogo (o crawler já aceita `--category`; filtros e WMI precisam
      de ajuste).

### Desempenho

- [ ] 🟢 Web Worker para expandir e filtrar o índice: medido em out/2026, não compensa ainda
      (expandir 30 ms; filtrar + contar facetas + agrupar 18–60 ms com 17.754 versões-ano).
      Medir de novo quando entrarem motos e caminhões.
- [ ] 🟢 Chunk principal (292 KB, 92 KB com gzip) é quase todo React DOM; só mexer se aparecer algo pesado.

- [ ] 🟢 Fichas técnicas da Stellantis: as que o casamento exato deixa de fora já vão pelo casamento
      aberto (`scripts/fichas/stellantis-open.ts`: linha, anos, motor, combustível, câmbio, cabine;
      vans só pelo nome da carroceria). Faltam as linhas fora do catálogo e o comprimento das vans
      (Cargo "Curto" ou "Médio" contra L1H1, L4H2). O documento 322 está indisponível no site.

## Futuro

- Conta para sincronizar os favoritos entre aparelhos: login pelo Cloudflare Access (código por
  e-mail, grátis até 50 usuários) e os favoritos numa tabela do D1, por rotas `/api/favoritos` no
  Worker; os do navegador sobem no primeiro login. Depois, aviso quando um favorito mudar X% na FIPE.
- Domínio próprio, para o cache das respostas da FIPE valer (o `caches.default` do Worker só
  funciona em domínio próprio).
- Teste de ponta a ponta (Playwright) dos fluxos principais: consulta → comparar, filtros do
  catálogo na URL, recarregar, busca pelo chassi (o `CatalogPage` já tem teste de componente).
- APIs pagas de consulta por placa (exige backend e atenção à LGPD).

## Concluído

- [x] Segurança e seguro na ficha: estrelas da Latin NCAP da linha (`npm run fetch:latinncap`, 198 testes,
      do ano antes do teste a cinco depois) e seguro estimado e roubos por mil da SUSEP AUTOSEG
      (`npm run fetch:seguro`, 2021, por código FIPE; a taxa do prêmio sobre o valor segurado vai
      aplicada ao preço FIPE de hoje, com o fator do estado). Atualizar o AUTOSEG quando a SUSEP
      publicar semestres novos (`--periodo=`).
- [x] Fichas técnicas da Stellantis: lista dos 460 links, checklist numerada para baixar à mão, leitor
      dos PDFs (dois formatos) e casamento com as versões FIPE; 458 fichas lidas dão números exatos a
      263 anos-modelo de 120 versões, na ficha e no comparador.
- [x] Galeria de fotos na página da versão: até 8 fotos por geração do Wikimedia Commons, com ângulo
      (frente, traseira, lateral, interior), crédito e vista ampliada. 8.243 fotos de 539 modelos.
- [x] Favoritos no navegador: estrela no card e na página da versão, aba Favoritos com a variação da
      FIPE desde que o carro foi marcado e "Comparar favoritos" (até 4).
- [x] Geração pela versão: quando as gerações se sobrepõem, a primeira palavra depois da linha
      escolhe a geração que também se chama assim ("Uno Mille" → 1ª geração, "Fiat Mille"; Clio
      Campus → Clio II; Sandero Stepway → Sandero II), e "(novo)" fica com a mais nova ("Gol (novo)"
      2013–2014 → G6). Fontes à mão para Volvo EX40, DFSK EC35, Hitech E-Work, Hafei Towner, Chana,
      Rely Van/Pick-up, Foton eView/eToano e JAC V260, que agora valem mesmo quando o Wikidata tem um
      modelo sem foto (137 → 104 versões sem foto).
- [x] Foto por geração: infobox de cada geração nos artigos da Wikipedia (pt, depois en) dá a cada
      ano-modelo a foto da sua geração (Gol G5/G6, HB20 1ª/2ª/atual, Sandero I/II/III); 850 fotos
      diferentes nos cards (eram 647). Fontes à mão para JAC T5/T50/T60/T80, BMW 220i/225i/435iA/M,
      Volvo XC 40, Ferrari 12Cilindri, MG 550, BYD eT3 e Mahindra SUV (157 → 137 versões sem foto).
Histórico resumido, em ordem aproximada.

**Base e arquitetura**

- [x] Daily no GitHub Actions (`.github/workflows/daily.yml`, 01:00): cache da varredura no Actions,
      semente na release `cache-semente`, dados commitados no `main`. Configuração única em
      `scripts/setup-github-daily.sh` (segredos, semente, deploy key da Action e ruleset que a aceita).
- [x] Proxy com rodízio de chaves: `FIPE_PROXY_TOKEN`, `FIPE_TOKEN` e as numeradas da maior para a
      menor, passando para a próxima em 429/401/403 e terminando no anônimo; no Vite e no Worker.

- [x] Repositório no GitHub (`adrielgamorim/carro-na-tela`, público), com autoria pelo e-mail
      privado do GitHub (noreply).
- [x] CI (GitHub Actions): lint, testes e build (com `tsc -b`) em cada push e PR, token só de
      leitura. Segurança: CodeQL (código e workflows), Dependabot (npm e Actions) e `SECURITY.md`.

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
- [x] Página da versão no lugar do diálogo: foto, nome e "Detalhes" do card abrem a página (ctrl+clique
      em nova aba), com troca de ano-modelo e retorno à lista na mesma posição.

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
- [x] `noUncheckedIndexedAccess` ligado no app e nos scripts (233 erros corrigidos, não os 84 de
      antes): grupos do catálogo tipados como não vazios, `at()` com erro claro para índices do
      formato do catálogo, `currentKey()` no crawler, `?? ""` em campos de CSV e grupos de regex.
- [x] Catálogo como aba inicial (`/`), com a Consulta em `?view=consulta`. Links antigos continuam
      valendo: `?view=catalogo` abre o catálogo, e uma consulta sem `view=` abre a Consulta. Feito
      com 28% dos preços; os demais cards mostram "Consultar preço".
- [x] Roteamento num lugar só: esquema de URLs e funções puras em `src/services/router.ts`, estado da
      aba e histórico em `src/hooks/useView.ts`, com testes. As URLs não mudaram. Um roteador de
      biblioteca só vale quando houver páginas de verdade (uma por marca, por exemplo).
- [x] Testes de componente do `VinSearch` (envio, erro, resultado, filtros aplicados, limpar).

**Logos de marca**

- [x] Logo da marca no lugar do ícone de carro nos cards do catálogo e da consulta: 44 marcas do
      Simple Icons (CC0) em `public/brands/` (`npm run build:brand-icons`), carregados como máscara
      CSS só quando aparecem e pintados na cor do tema. Mercedes-Benz, BYD, Land Rover, Jaguar e
      outras pediram ao Simple Icons a remoção dos logos e ficam com o ícone de carro.

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
- [x] Fase 4, parte 1: dimensões (comprimento, largura, altura, entre-eixos) e peso da linha do modelo
      pelo Wikidata, com "≈" na ficha e no comparador. Comprimento em 36% das versões, peso em 7%;
      a potência continua vindo do nome FIPE (16%).
- [x] Fase 4, parte 2: infobox da Wikipedia (pt/en) completa dimensões, peso e potência (faixa da linha).
      Comprimento em 59% das versões, peso em 43%, potência em 47% (com o nome FIPE).
- [x] Fase 4, parte 3: porta-malas e torque dos releases da Stellantis Brasil, revisados à mão
      (86 valores), na ficha e no comparador com link para o release: 358 versões.
- [x] Modelos do Wikidata sem foto usam a da linha (Hilux SW4, 911 Targa, Fiesta Sedan, Titano…) e
      fontes escolhidas à mão em `data/wikidata/fallback-titles.json` (Zafira, Sprinter, RAM 2500/3500/
      Classic, GWM Poer, Jinbei Topic, Neta X): versões com foto de 4.764 para 4.864.
- [x] Reserva de fotos (Wikipedia pt/en e Commons) para as linhas sem modelo no Wikidata: 71 de 150
      linhas, versões com foto de 4.493 para 4.764 (Punto, Daily, Basalt, Sealion, F-Type…).
- [x] Wikidata / Commons: foto e descrição da linha (4.555 versões, 577 modelos). Cobertura de fotos
      de 4.227 para 4.493 versões: BMW por série ("320iA" → Série 3), abreviações da Land Rover,
      nomes sem parênteses e código de chassi, e ajustes manuais (C3 Aircross, Classe M, AMG GT).
- [x] Chassi (VIN): WMI da Wikipedia (1.536 códigos), ano pelo 10º caractere e NHTSA vPIC.
- [x] Senatran: frota em circulação por linha (4.750 versões em 677 linhas), ordenação "Mais comuns
      na frota", que intercala as linhas (a versão mais nova de cada uma, depois a segunda…)
      para a primeira página não ser só de Gol.
