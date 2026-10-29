# Carro na tela

[![CI](https://github.com/adrielgamorim/carro-na-tela/actions/workflows/ci.yml/badge.svg)](https://github.com/adrielgamorim/carro-na-tela/actions/workflows/ci.yml)
[![CodeQL](https://github.com/adrielgamorim/carro-na-tela/actions/workflows/codeql.yml/badge.svg)](https://github.com/adrielgamorim/carro-na-tela/actions/workflows/codeql.yml)

Consulta de valores da tabela FIPE, catálogo de carros com busca por facetas e comparação de
veículos, com dados abertos do INMETRO, ANP, Senatran e Wikidata somados ao preço.

Feito com React 19, TypeScript 6 e Vite 8, sem backend próprio: o catálogo é um índice estático
gerado por scripts Node, e a consulta ao vivo passa por um proxy fino da API FIPE v2 da Parallelum.

- [O que já existe](#o-que-já-existe)
- [Como rodar](#como-rodar)
- [Dados: de onde vêm e como atualizar](#dados-de-onde-vêm-e-como-atualizar)
- [Proxy da FIPE e publicação](#proxy-da-fipe-e-publicação)
- [Arquitetura](#arquitetura)
- [O que falta](#o-que-falta)

## O que já existe

**Catálogo** (página inicial)

- Índice estático das versões-ano de carros da FIPE: 5.021 versões e 17.754 versões-ano de 2009 em
  diante (80 marcas), 13.381 com preço; versões sem preço têm "Consultar preço", que busca ao vivo. A
  varredura agora desce até 1985, o ano mais antigo da tabela (mais 1.195 pares marca-ano, ~11 mil
  versões-ano, e as 28 marcas que só têm modelos antigos); os anos antigos entram à medida que a
  listagem e os preços avançam, só com preço e o que vem do nome FIPE (o INMETRO começa em 2009).
- Filtros por marca, linha, procedência (nacional/importado), configuração, ano, preço, propulsão, combustível, câmbio e marchas,
  cilindrada, portas, porte, consumo, direção, ar, turbo, 4x4 e 0 km, todos refletidos na URL.
- Marcas que a FIPE lista com mais de um nome viram uma só (`src/catalog/brands.ts`): "Caoa Chery" e
  "Caoa Chery/Chery" são Chery; "Caoa Changan", "CHANGAN" e "CHANA" são Changan. O nome da FIPE
  continua em cada versão para a Consulta e os links antigos.
- A linha é escrita igual em todas as versões da marca ("UNO" e "Uno" viram uma linha só) e, com uma
  linha marcada, aparece "Versão da linha": a palavra depois do modelo no nome FIPE (Uno Way, Uno
  Mille, Onix Hatch), com as abreviações juntadas à palavra inteira ("ATTRACTI.", "SD.", "P-Up").
- Ordenação por preço, ano, consumo, nome e "Mais comuns na frota".
- Cards com o logo colorido da marca (59 marcas, de `npm run fetch:brand-logos`; as demais ficam
  com o ícone monocromático do Simple Icons ou o do tipo de veículo), foto do modelo (Wikimedia
  Commons, da geração do ano escolhido quando o artigo da Wikipedia separa gerações), frota em
  circulação, posição no ranking e IPVA estimado logo abaixo do valor FIPE (no estado das premissas).
- Busca pelo chassi (VIN): fabricante, país e ano-modelo decodificados no navegador; modelo e
  motor pela NHTSA vPIC quando ela conhece o veículo. O resultado vira filtros.

**Consulta FIPE** (`?view=consulta`)

- Cascata referência → marca → linha → modelo ↔ ano (o ano pode vir antes do modelo), ou busca
  direta pelo código FIPE (tenta carros, motos e caminhões). O 0 km aparece como "0 km".
- Seleção na URL e botão "Copiar link da consulta". As consultas e o comparador ficam salvos no
  navegador.

**Detalhes e comparador** (nas duas abas)

- Ficha técnica (nome FIPE + INMETRO), histórico de preços com sparkline, IPVA estimado por
  estado, custo por km, depreciação média da versão, "Sobre o modelo" (Wikipedia/Wikidata) e frota
  em circulação (Senatran). Nas marcas da Stellantis, porta-malas e torque dos releases de imprensa,
  com link para o release (também no comparador).
- No catálogo, a foto, o nome ou "Detalhes" abrem a página da versão (`?versao=<id>`), com
  galeria, todos os anos-modelo, preço, ficha, custos e histórico. O link pode ser compartilhado, e
  o botão Voltar do navegador retorna à lista com os mesmos filtros e a mesma posição.
- Galeria da página da versão: até 8 fotos da geração do ano escolhido (Wikimedia Commons), com
  frente, traseira, lateral e interior marcados nas miniaturas, crédito de cada foto e vista
  ampliada. São 8.243 fotos de 539 modelos.
- Comparador lado a lado de até 4 veículos, com premissas editáveis: estado (IPVA e preço do
  combustível pela ANP) e preços próprios.
- Favoritos: a estrela no card ou na página da versão guarda o ano-modelo e o preço FIPE daquele
  momento; a aba Favoritos (`?view=favoritos`) mostra os cards marcados com a variação desde então
  e compara até 4 de uma vez. Ficam no navegador (`localStorage`), sem conta.
- Cada dado traz a fonte e a confiança: "exata" quando é desta versão, "aproximada" quando foi
  casado pelo nome e pode descrever uma versão vizinha.

## Como rodar

```bash
npm install
cp .env.example .env   # e defina FIPE_TOKEN (chave gratuita do fipe.api.br)
npm run dev            # servidor de desenvolvimento, com o proxy da FIPE embutido
npm test               # testes (Vitest)
npm run lint           # ESLint
npm run build          # typecheck + build de produção em dist/
```

A CI (`.github/workflows/ci.yml`) roda lint, testes e build em cada push e pull request; o
CodeQL analisa o código e os workflows, e o Dependabot abre PRs semanais de atualização.

As chaves ficam só no servidor (`.env`, lido pelo Vite e pelos scripts). Nunca crie uma variável
`VITE_*` com elas: essas vão para o bundle do navegador.

### Scripts de dados

```bash
npm run crawl:fipe       # varredura da FIPE: listagem, depois preços → data/fipe/
npm run parse:pbev       # PDFs do INMETRO → data/inmetro/pbev-<ano>.json
npm run fetch:wikidata   # modelos, resumos e créditos das fotos → data/wikidata/
npm run fetch:galeria    # galeria de fotos por modelo (Commons) → data/wikidata/gallery.json
npm run fetch:frota      # frota Senatran por marca/modelo e ano (mensal) → data/frota/frota.json
npm run fetch:anp        # preço médio dos combustíveis por estado → public/catalog/fuel-prices.json
npm run fetch:wmi        # códigos de fabricante do chassi → public/catalog/wmi.json
npm run crawl:imprensa   # releases da Stellantis Brasil → data/imprensa/stellantis-releases.jsonl
npm run extract:imprensa # porta-malas e torque a revisar → data/imprensa/stellantis-candidates.json
npm run fichas:links     # links das fichas técnicas da Stellantis → data/fichas/links.json
npm run fichas:lista     # lista para baixar as fichas à mão → data/fichas/lista.html
npm run fichas:ler       # lê os PDFs baixados (--de=<pasta> move de Downloads) → data/fichas/fichas.json
npm run build:catalog    # data/* → public/catalog/index.json
npm run daily            # crawl:fipe + fetch:frota (+ wikidata/wmi mensais) + build:catalog + fetch:anp
npm run schedule:daily   # agenda o daily no Agendador de Tarefas do Windows (01:00)
npm run unschedule:daily # remove a tarefa agendada
```

## Dados: de onde vêm e como atualizar

| Fonte | O que traz | Script | Frequência | Cobertura hoje |
|---|---|---|---|---|
| FIPE (API Parallelum) | Versões, anos, preços, histórico | `crawl:fipe` | Diária (limite de requisições) | De 2009 em diante: listagem completa, 75% com preço; de 1985 a 2008 em andamento |
| INMETRO PBEV 2010–2026 | Consumo, porte, câmbio, marchas, direção, ar, autonomia | `parse:pbev` | Anual (PDF novo) | ~3.000 versões |
| Wikidata / Commons / Wikipedia | Foto, descrição, dimensões, peso e potência da linha do modelo | `fetch:wikidata` | De vez em quando | 4.917 versões com foto |
| Wikimedia Commons (categorias) | Galeria por geração: frente, traseira, lateral, interior | `fetch:galeria` | De vez em quando | 8.243 fotos de 539 modelos |
| Senatran (Renavam) | Frota em circulação por linha | `fetch:frota` | Mensal | 4.750 versões, 677 linhas |
| ANP | Preço médio dos combustíveis por estado | `fetch:anp` | Semanal | 27 estados |
| Fichas técnicas da Stellantis (PDF baixado à mão) | Potência, torque, peso, medidas, porta-malas, tanque, vão livre, velocidade, 0–100 da versão e ano | `fichas:links`, `fichas:ler` | A cada lote baixado | 458 fichas lidas: 263 anos-modelo de 120 versões |
| Releases da Stellantis Brasil | Porta-malas e torque (revisados à mão) | `crawl:imprensa`, `extract:imprensa` | De vez em quando | 358 versões (Fiat, Jeep, Citroën, Peugeot, RAM, Leapmotor) |
| Wikipedia (lista de WMI) | Fabricante e país do chassi | `fetch:wmi` | Raramente | 1.536 códigos |
| NHTSA vPIC | Modelo e motor pelo chassi (ao vivo) | — | — | Bom para importados, raro para nacionais |

Tudo o que é casado pelo nome tem ajuste manual em `data/<fonte>/overrides.json` (com `reason`).

### FIPE: varredura offline

`npm run crawl:fipe` grava `data/fipe/<categoria>-<referência>.json` em duas fases:

1. **Listagem** (marca → ano → modelos do ano): todas as versões e anos, com combustível e
   atributos extraídos do nome (motor, válvulas, turbo, câmbio, portas, 4x4, carroceria,
   propulsão). Uma requisição por marca-ano, do ano mais novo para o mais antigo.
2. **Preços** (detalhe de cada versão-ano): só começa quando a listagem está completa, com o 0 km
   primeiro e depois os anos mais novos.

- Cada resposta fica em cache em `.cache/fipe/<referência>/`. Se a varredura parar (limite diário,
  `--max-requests`, queda de rede), basta rodar de novo: o snapshot é sempre remontado a partir do
  cache inteiro.
- Limites da API: 500 requisições/dia sem chave e 1.000/dia com a chave gratuita. Com `FIPE_TOKEN`
  e/ou `FIPE_TOKEN1`, `FIPE_TOKEN2`… no `.env`, quando uma chave atinge o limite (ou é recusada), a
  próxima assume; o acesso anônimo fica por último.
- Opções: `--phase=all|listing`, `--offline` (só remonta o snapshot; exige `--reference`),
  `--reference`, `--category=cars|motorcycles|trucks`, `--min-year` (padrão 1985, o ano mais antigo da tabela), `--brands`,
  `--max-requests`, `--reserve` (requisições a preservar na última chave, padrão 20; as outras
  são usadas até zerar), `--interval-ms`
  (padrão 1300), `--out`, `--cache`.
- `npm run build:catalog` junta tudo em `public/catalog/index.json` (formato compacto v2: uma linha
  por versão, com anos e preços aninhados e as fontes casadas), que a aba Catálogo carrega e
  filtra no navegador. Também grava uma fatia por categoria e marca em `public/catalog/marcas/`
  (mesmo formato, até ~250 KB, ~25 KB com gzip): a Consulta FIPE carrega só a fatia da marca do
  veículo para os detalhes e o comparador, em vez do índice inteiro.

### INMETRO (PBEV)

- `npm run parse:pbev` lê os PDFs oficiais pela posição das colunas, com layout por ano (2010–2026;
  `--year=all|AAAA`, `--dir`). 2009 fica de fora porque tem dois valores por célula.
- O `build:catalog` casa cada versão FIPE com a tabela dos seus anos-modelo: a tabela do ano T vale
  de T−1 a T+1, o 0 km usa só a mais nova, e vence a tabela mais nova que casar. Para casar, a
  linha precisa ter mesma marca e modelo, sem conflito de motor, câmbio, combustível ou propulsão. A
  confiança é "exata" quando a versão também bate.
- Ajustes em `data/inmetro/overrides.json`: forçar uma linha (`use`), pular tabelas (`skipTables`)
  ou remover o casamento (`none`). O build avisa quando um `use` não acha a linha.

### Galeria de fotos (Wikimedia Commons)

- `npm run fetch:galeria` parte da categoria de cada modelo no Commons (propriedade P373 do
  Wikidata) e desce até 3 níveis, até 14 categorias por modelo: primeiro a geração mais nova e as
  carrocerias, mercados e interiores dela, depois a geração seguinte; outros modelos da família
  ("Corolla Verso") só se sobrar espaço. Quando uma geração nova rende menos de 10 fotos (árvores
  fundas, como a do Corolla), uma busca `deepcat:` traz as fotos dela de uma vez.
- Ficam de fora corrida, táxi, polícia, acidentes, miniaturas, desenhos, detalhes (emblema, roda,
  motor), carros de preparadoras e fotos cujo nome não cita o modelo (cenas de rua). O ano vem do
  nome do arquivo (não a data em que a foto foi tirada) e põe a foto na geração certa; fotos
  anteriores ao primeiro ano do modelo no catálogo saem. Por geração, até 8 fotos, uma de cada
  ângulo primeiro, preferindo as maiores, horizontais e do Brasil.
- Com bot password no `.env` (`WIKIMEDIA_BOT_USER`, `WIKIMEDIA_BOT_PASSWORD`; Special:BotPasswords,
  só leitura) o script faz login e vai a ~100 pedidos por minuto; sem conta, a ~10. Cada resposta
  fica em `.cache/galeria` e uma rodada interrompida continua de onde parou; falhas passageiras
  do Wikimedia (503, banco de dados, busca ocupada) esperam e tentam de novo.
- O `build:catalog` escreve um arquivo por modelo em `public/catalog/galeria/<id>.json` (4,6 MB no
  total), que a página da versão carrega só quando abre.

### Wikidata (fotos e descrições)

- `npm run fetch:wikidata` baixa os modelos de carro do Wikidata para `data/wikidata/models.json`
  e, para os que casam com versões FIPE, o resumo da Wikipedia em português e o autor e a licença da
  foto para `data/wikidata/details.json` (`--cached` reaproveita os modelos já baixados).
- O casamento é pelo nome ("Chevrolet Onix" → início do nome FIPE "Onix…"), preferindo o nome mais
  longo, a marca certa e a geração dos anos da versão. Nomes do Wikidata valem também sem o ano entre
  parênteses e sem o código de chassi ("BMW i3 (2013)", "Defender L663"), e a FIPE é lida também
  pelos apelidos de BMW ("320iA" → Série 3) e Land Rover ("Defe.", "Discov."). A página descreve a
  linha, não a versão.
- **Dimensões, peso e potência:** comprimento, largura, altura, entre-eixos e massa dos modelos
  casados (quantidades normalizadas do Wikidata), completados campo a campo pela infobox dos artigos
  da Wikipedia em português e depois em inglês ("Info/Automóvel", "Infobox automobile": modelos
  `{{converter}}`/`{{cvt}}`, texto solto e a potência da lista de motores). Valores implausíveis são
  descartados e há faixa quando há mais de um. Cada artigo é lido uma vez (`data/wikidata/infobox.json`);
  o resultado fica em `data/wikidata/specs.json`. São da linha do modelo, então aparecem com "≈" na
  ficha e no comparador; a potência exata do nome FIPE tem prioridade. Cobrem ~59% das versões
  (comprimento), ~43% (peso) e ~47% (potência, somando o nome FIPE).
- **Reserva:** as linhas que não casam com o Wikidata (Fiat Punto, Iveco Daily, Citroën Basalt…)
  buscam o artigo "Marca Linha" na Wikipedia (pt, depois en) e, por último, um arquivo no Commons;
  só vale um título com a marca e o nome da linha. Ficam de fora marcas que são palavras comuns
  (Wake, Baby, Rely…) e linhas de uma letra. O resultado fica em `data/wikidata/fallback.json`
  ("nada" também, para não buscar de novo); apague uma entrada para buscá-la outra vez. Um modelo do
  Wikidata sem foto usa a da sua linha, desde que o título dela tenha o nome do modelo ("Toyota
  Hilux" serve para o Hilux SW4; "Volvo XC90" não serve para o EX40). Linhas que a busca erra têm a
  fonte escolhida à mão em `data/wikidata/fallback-titles.json` (artigo ou arquivo, com o motivo),
  que vale também quando o Wikidata tem um modelo sem foto com outro nome (EX40 → Volvo XC40).
- **Foto por geração:** artigos com uma infobox por geração (pt:Volkswagen Gol tem do G1 ao G6, cada
  uma com foto e anos de produção) dão a cada ano-modelo a foto da sua geração: a de período mais
  curto que cobre o ano, e um ano depois do fim só quando nenhuma cobre o ano em si (Brasil primeiro
  quando a produção vem por país). Quando as gerações se sobrepõem, o nome da versão desempata antes:
  vale a geração cujo nome ou "outros nomes" tem uma palavra dele ("Uno Mille" é a 1ª geração, também
  chamada "Fiat Mille"), e "(novo)" fica com a geração mais nova daquele ano ("Gol (novo)" 2013 é o
  G6, não o G4). O artigo em português vem antes do inglês; artigos com uma infobox
  só não entram. Cada artigo é lido inteiro uma vez (`data/wikidata/generation-articles.json`) e os
  créditos de cada foto também (`generation-photos.json`); o resultado por modelo fica em
  `generations.json`. No índice, cada ano da versão aponta para a foto (`g`, em `photos`), então o
  card troca a foto ao trocar o ano. São ~2.960 versões e 10.400 anos-modelo, e 850 fotos diferentes
  nos cards (eram 647).

### Senatran (frota em circulação)

- `npm run fetch:frota` acha pela API do dados.transportes.gov.br o arquivo mais recente de frota
  por UF, município, marca/modelo e ano de fabricação (zip de ~140 MB, texto de 1,2 GB, domínio
  público). Guarda o zip em `.cache/frota` (só baixa de novo quando sai um mês novo) e grava o
  total por marca/modelo e ano, nacional e por estado, em `data/frota/frota.json`, em ~25 s.
- O `build:catalog` casa os nomes do Renavam ("CHEV/ONIX 10MT LT", "I/TOYOTA HILUX …") com as
  linhas do catálogo (marca + família FIPE), reconhecendo os códigos de marca (CHEV, GM, VW,
  M.BENZ, MMC…) e os importados (I/, IMP/). O número é da linha toda: indica popularidade, não
  vendas. Cada linha guarda também o total e a posição por estado; os detalhes mostram os do estado
  escolhido nas premissas.

### Releases de imprensa (porta-malas e torque)

- `npm run crawl:imprensa` lê o sitemap da sala de imprensa da Stellantis Brasil
  (media.stellantis.com/br-pt) e os releases das marcas de carro que parecem falar de um modelo
  (~2.900), um a cada 1,5 s, com user-agent identificado; o robots.txt permite essas páginas. As
  fichas técnicas em PDF ficam atrás de proteção contra robôs e não são baixadas. Guarda o texto
  em `data/imprensa/stellantis-releases.jsonl` (fora do git) e retoma de onde parou.
- `npm run extract:imprensa` acha nas frases o porta-malas (com os bancos em pé) e o torque com o
  motor de que falam (cilindrada, turbo, diesel, válvulas) e lista os candidatos ainda não revisados.
  A prosa varia muito (volume com bancos rebatidos, bolsa de caçamba, dois motores na mesma frase),
  então cada valor é revisado à mão em `data/imprensa/stellantis.json`: os certos vão para `facts`
  (com `words`/`notWords` quando valem só para algumas versões), os errados para `rejected`.
  Hoje são 86 aceitos e 33 rejeitados.
- O `build:catalog` dá a cada ano-modelo o valor mais recente da linha a partir do ano do release
  (por até 8 anos ou até o próximo valor), e o torque só às versões daquele motor. Só as marcas da
  Stellantis têm sala de imprensa aberta assim; GM e VW não liberam.

### Fichas técnicas da Stellantis

- `npm run fichas:links` lê o menu de modelos de cada marca na sala de imprensa e as páginas de
  modelo e ano ("Fiat Pulse MY 2022"), que o robots.txt permite, uma a cada 1,5 s, e grava em
  `data/fichas/links.json` o link de cada ficha (460 hoje).
- Os PDFs ficam atrás da proteção contra robôs do site, então são baixados à mão: `npm run
  fichas:lista` gera `data/fichas/lista.html`, por marca e ano, numerada e com ✓ nas já lidas. Um
  arquivo baixado com o número da lista na frente ("053-…pdf") diz de qual link veio; sem número,
  vale o nome do arquivo. `npm run fichas:ler` (com `-- --de="%USERPROFILE%\Downloads"` move de
  Downloads) lê os PDFs de `data/fichas/pdf` (fora do git) em `data/fichas/fichas.json`: o título vem
  do cabeçalho do próprio PDF (o link às vezes é de outra ficha da página), e os campos tanto de
  "Campo: valor" quanto de tabelas, só com valores possíveis para um carro.
- O `build:catalog` dá a ficha a cada versão-ano de mesma linha (pela página), ano, acabamentos
  (os da linha na FIPE que o título cita, mesmo colados: "fichatecnicapulsedrive13flex…"), motor,
  câmbio e cabine (CD/CS/CE). Na ficha técnica, os números exatos dela substituem as medidas
  aproximadas da linha.

### ANP (combustíveis)

- `npm run fetch:anp` baixa o levantamento das últimas 4 semanas (um preço por posto) e grava a
  média de gasolina comum, etanol e diesel S10 por estado e nacional, da semana mais recente. O
  gov.br recusa requisições sem cabeçalhos de navegador, por isso o script os envia.
- O app usa os preços do estado escolhido e guarda só os que o usuário editar. Sem o arquivo,
  valem as médias fixas de `src/catalog/costs.ts`. Energia elétrica é uma tarifa típica editável.

### Chassi (WMI e NHTSA vPIC)

- `npm run fetch:wmi` baixa a lista de WMI (3 primeiros caracteres do chassi) do artigo "Vehicle
  identification number" da Wikipedia em inglês e casa cada fabricante com as marcas FIPE. Os
  países são traduzidos por `scripts/vin/countries-pt.json`. Motos, caminhões e ônibus ficam sem
  marca, porque o catálogo só tem carros. A vPIC não conhece a maioria dos WMIs nacionais.
- O ano-modelo vem do 10º caractere (o código se repete a cada 30 anos; vale o mais recente até o
  ano que vem). O chassi não é guardado; só a NHTSA o recebe.

### Atualização automática

`npm run daily` roda varredura, frota, índice e ANP (e Wikidata e WMI quando têm mais de 30 dias),
com uma trava contra execuções simultâneas e log em `logs/daily-<data>.log`.

- **No GitHub (padrão):** o workflow `.github/workflows/daily.yml` roda à 01:00 (Brasília) com as
  chaves dos segredos `FIPE_TOKEN*`, guarda `.cache/` no cache do Actions para a varredura
  continuar de onde parou e commita `data/` e `public/catalog/` no `main`. Se uma fonte falhar,
  as outras são publicadas e a execução fica marcada como falha. Uma vez,
  `scripts/setup-github-daily.sh` grava os segredos, publica a semente do cache (release
  `cache-semente`), cria a deploy key com que a Action publica e o ruleset do `main` que a aceita.
- **No Windows:** `npm run schedule:daily` agenda à 01:00; `npm run unschedule:daily` remove. Não
  use os dois ao mesmo tempo: eles dividem a cota das chaves.

## Proxy da FIPE e publicação

O navegador nunca chama a FIPE direto: tudo passa por `/api/fipe`, que injeta a chave, só aceita
as rotas de leitura que o app usa e guarda as respostas em cache. Dados de um mês de referência
não mudam, então ficam 30 dias no cache; a lista de referências, 6 horas.

- **Dev e `npm run preview`:** o proxy roda dentro do servidor do Vite (`server/vite-plugin.ts`),
  com cache em memória. Ele tenta `FIPE_PROXY_TOKEN`, `FIPE_TOKEN` e as numeradas da maior para a
  menor (o crawler usa da menor para a maior), passando para a próxima em 429 ou chave recusada e
  terminando no acesso anônimo. Uma chave só para o proxy evita dividir a cota com o crawler.
- **Produção:** um Cloudflare Worker só (`worker/index.ts`, configuração em `wrangler.toml`) serve o
  build (`dist/`) como arquivos estáticos e o proxy em `/api/fipe`, no mesmo domínio: o build usa o
  `/api/fipe` padrão, sem `VITE_FIPE_API_URL` nem CORS. Só `/api/*` executa o código; o resto sai
  dos arquivos estáticos, que não contam no limite de requisições. Rotas do app (`?versao=`,
  `?view=consulta`) caem no `index.html`. O cache das respostas da FIPE só vale num domínio próprio
  (em `*.workers.dev` cada consulta vai à FIPE).
- Para testar o build como na Cloudflare, sem conta: `npm run build && npx wrangler dev` (lê as
  chaves do `.env`).

- A lógica fica em `server/fipe-proxy.ts` (rotas, cache, CORS, erros), a mesma nos dois ambientes.

## Arquitetura

**Stack:** React 19 (só `lucide-react` de dependência), TypeScript 6 (strict por padrão), Vite 8,
Vitest 5 com jsdom e Testing Library, ESLint 10. Os scripts rodam com o TypeScript nativo do Node
24, por isso imports relativos alcançados por eles usam a extensão `.ts`.

**Princípios**

- Dados pesados são pré-calculados offline e servidos como JSON estático em `public/catalog/`; o
  navegador só filtra. Cada tela baixa só o que usa: a Consulta, que é a aba inicial, não carrega
  o código nem o índice do Catálogo (chunk próprio via `React.lazy`, buscado ao passar o mouse no
  link), e a tabela comparativa também é um chunk à parte.
- No build de produção, um service worker (`public/sw.js`) guarda a página, os assets e os JSONs do
  catálogo: com internet vale sempre a versão nova; sem internet, abre a última baixada. O proxy da
  FIPE não passa por ele.
- Cada fonte externa é um *provider* com resultado `{ source, confidence, data }`. O
  `enrichment.ts` consulta todos em paralelo, e uma fonte que falha não derruba as outras.
- Funções puras para parsing, casamento e filtros, testadas sem rede; os efeitos ficam nos hooks e
  nos scripts.
- A URL é o estado compartilhável: cada aba guarda nela só os próprios parâmetros.
- Cores só por tokens (`src/index.css`), com tema claro e escuro conforme o sistema. Cada componente
  importa o próprio `.css`; `App.css` e `catalog/catalog.css` têm só o que é compartilhado.

| Caminho | Papel |
|---|---|
| `src/App.tsx` | Abas (Catálogo / Consulta FIPE) na URL; consultas e comparador salvos |
| `src/components/catalog/` | Catálogo: página, facetas, cards, comparador em tabela, busca pelo chassi |
| `src/components/` | Consulta: `SearchPanel`, `ResultsPanel`, `VehicleCard`, `VehicleDetails`, `ComparisonPanel`, `PriceSparkline`, premissas de custo |
| `src/hooks/` | `useFipeCatalog` (cascata: efeitos; reducer puro em `fipeCatalogState.ts`), `useFipeCodeLookup`, `useCatalogIndex`, `useVehicleEnrichment`, `useVinSearch` |
| `src/catalog/` | Domínio do catálogo: formato do índice, filtros e URL, nome FIPE → atributos, custos (IPVA, custo/km), tipos de INMETRO, Wikidata, frota, ANP, chassi |
| `src/services/` | Cliente HTTP (timeout, `AbortSignal`, `HttpError`, cache), API FIPE, providers, enriquecimento, vPIC, URL da consulta, `localStorage` |
| `server/`, `worker/` | Proxy da FIPE (handler comum, plugin do Vite, Cloudflare Worker) |
| `scripts/catalog/` | Crawler (cliente com cache em disco e rodízio de chaves, percurso, CLI), índice, daily |
| `scripts/inmetro/`, `wikidata/`, `frota/`, `anp/`, `vin/`, `imprensa/`, `fichas/` | Download, leitura e casamento de cada fonte |
| `data/` | Snapshots e dados de entrada do índice (gerados pelos scripts, mais os `overrides.json`) |
| `docs/PLANO-CATALOGO.md` | Plano original do catálogo e das fontes |

## O que falta

As pendências estão em [TODO.md](TODO.md), por área e prioridade. As principais:

- Publicar: deploy do site e do Worker, daily fora do Windows.
- Dados: completar os preços da varredura (semanas) e pôr o Catálogo como aba inicial.
- Qualidade: testes de ponta a ponta e CSS separado por componente.
- Produto: motos e caminhões no catálogo.
