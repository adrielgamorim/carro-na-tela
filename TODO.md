# TODO — Carro na tela

O projeto está completo: não há trabalho de desenvolvimento em aberto. Este arquivo guarda a
rotina de [manutenção](#manutenção), os [limites conhecidos](#limites-conhecidos) (o que não tem
fonte aberta, para rever se algo mudar), as ideias para o [futuro](#futuro) e o que já foi
[concluído](#concluído). Antes de integrar uma fonte nova, confira os termos de uso dela.

## A fazer

- [x] Acrescentar um botão em cada card do catálogo ou nos detalhes para pesquisar aquele modelo no WebMotors, iCarros, OLX e Mercado Livre, com o link de busca já preenchido.

- [x] Mostrar de alguma forma quando pro usuário no catálogo quando o carro que ele está olhando foi favoritado, mesmo não sendo o mesmo ano (mostrar uma meia estrela? ou mostrar uma estrela na pill do ano?)

- [ ] Adquirir informações sobre quantidade de veículos emplacados no brasil e casar com modelos para criar um novo filtro/sort de "Mais vendidos" no ano e no mês com essas informações.
  - FENABRAVE (Federação Nacional da Distribuição de Veículos Automotores): É a entidade privada que representa as concessionárias. Ela divulga mensalmente os relatórios mais detalhados e utilizados pelo mercado sobre o ranking de emplacamentos de carros novos por marca, modelo e região. Você pode acompanhar as atualizações diretamente no Portal Fenabrave.
  - Ministério dos Transportes / Senatran: O governo disponibiliza o painel estatístico e o inventário da frota brasileira com dados abertos e detalhados por estado (UF) e município através do Portal de Dados Abertos dos Transportes.

## Manutenção

O que roda sozinho e o que precisa de uma rodada de vez em quando.

- **Daily (sozinha):** o GitHub Actions (`.github/workflows/daily.yml`) busca os preços da FIPE,
  a frota e os combustíveis, commita os dados no `main` e republica o site na Cloudflare, às 04:00
  e às 18:00 UTC. O site usa só a `FIPE_PROXY_TOKEN` (segredo do Worker); as numeradas são da daily. A cota de
  cada chave da FIPE vale 24 h desde o primeiro uso (`x-ratelimit-reset: 86400`), e o GitHub
  atrasa o cron das 04:00 para 11–12 UTC; a segunda execução pega a cota quando a primeira acha
  as chaves esgotadas. Um mês novo leva alguns dias para ter todos os preços (em 10/11/2026,
  novembro estava com 71% dos carros, 100% das motos e 70% dos caminhões), e o catálogo só troca
  de mês quando o novo é tão bom quanto o anterior (`selectLatestSnapshots`).
- **Todo ano:** as alíquotas de IPVA por categoria e os preços padrão de combustível
  (`src/catalog/costs.ts`, hoje out/2026), e o PBEV do INMETRO quando sair o de 2027
  (`npm run parse:pbev`).
- **De vez em quando:**
  - `npm run fetch:openverse`: mais fotos do Flickr. Em 10/11/2026, 878 de 1.636 modelos têm
    4.158 fotos e 406 ficaram sem resposta; o serviço esgota o tempo no meio, e o cache guarda o
    que já veio. A chave (`OPENVERSE_CLIENT_ID`/`SECRET` no `.env`) já está em uso.
  - `npm run crawl:releases` e `npm run extract:equipamentos`: equipamentos dos releases novos
    (em `data/imprensa/equipamentos-candidates.json`, para revisar). Os em prosa são reescritos à
    mão, e os da Volkswagen são todos lidos à mão. Em 10/11/2026 não havia nenhum novo, e 373
    notícias da VW seguem sem resposta. Também `npm run extract:imprensa`.
  - `npm run fetch:wikidata` e `npm run fetch:galeria` quando entrarem modelos novos na FIPE.
  - `npm run test:e2e` (Playwright, só local) depois de mudanças no catálogo.

## Limites conhecidos

O que se sabe de cada um, para rever se algo mudar. Não são tarefas.

- **Fotos que faltam:** ~79 versões recentes, quase todas utilitários e marcas de nicho sem foto
  livre (Hitech Electric Delivery/e.co, Effa, Foton Minitruck, Shineray, Wake, buggies), os JAC
  iEV 20/330P/350T/750V/1200T e E-J\* (o "JAC iEV 002" do Commons é um iEV5, por isso o iEV 20 está
  como `none` em `fallback-titles.json`), o Jetour S06 e o GAC GS9 (falta saber a que modelo
  chinês correspondem). A saída seria a foto de imprensa autorizada da marca.
- **Motos e caminhões sem modelo:** ~750 motos (Shineray, Dafra, Kasinski, Traxx…: marcas sem
  artigo; Honda CG 150/160, CB 500 e Yamaha Crosser/Factor, que o Wikidata não tem nessas
  cilindradas) e ~300 caminhões de nome só numérico (Mercedes-Benz "1214", VW "12-140", Agrale
  "13000", Chevrolet "11000"). Da Mercedes o Wikidata só tem as séries L, LP, NG e SK, sem dizer
  qual cabine é cada número: só um `overrides.json` feito à mão por quem conhece os modelos.
- **Fichas da Stellantis:** faltam as linhas fora do catálogo, os motores sem ficha (Jumpy e
  Expert 1.6, Jumper 2.0, Boxer de outros anos, Ducato Chassi e Executivo 2019–20) e o
  comprimento das vans (a FIPE não diz L1H1 ou L3H2: as que empatam dão só os números em comum).
  A ficha da versão mais próxima leva o aviso (`otherTrim`, 26 fichas, como a 1500 Laramie 2026
  com a da Big Horn). O documento 322 está indisponível no site.
- **Manuais do proprietário de outras marcas:** a Hyundai lista os seus em
  `/proprietarios.model.json`, mas são só os ~10 dos modelos atuais, que os catálogos já cobrem; o
  site da Honda responde "Access Denied" (Akamai).
- **Equipamentos sem release por versão:** Polo 2023, Amarok 2018 e 2020; e as versões que a FIPE
  ainda não tem (Saveiro Robust Etanol, Amarok Barretos, T-Cross Seleção).
- Recalls por modelo: o conjunto "Campanhas de Recall" da Senatran (dados.transportes.gov.br,
  `recall`) só tem o total do ano; a consulta oficial é por placa ou chassi, com login gov.br. Ver
  de novo se a Senacon publicar a lista de campanhas. Pista: a Hyundai publica as suas em
  `/proprietarios.model.json` (veículo, ano-modelo, faixa de chassi, número do aviso); ver se as
  outras marcas têm listas assim antes de fazer só para uma.
- Roubos e furtos por modelo pela SSP-SP: o AUTOSEG já dá os roubos por mil carros segurados; a
  transparência da SSP-SP só tem boletins um a um, num formulário ASP.NET.
- Revisões com preço fixo: os sites das marcas consultam por modelo e CEP dentro dos seus apps; as
  tabelas que aparecem são de reportagens antigas.
- Fichas da Chevrolet e da Mitsubishi: a sala de imprensa da Chevrolet pede login, a da Mitsubishi
  só tem notícias, e o Wayback guardou só 5 PDFs da Chevrolet (Sonic 2027, com série/opcional por
  ícone). Nos sites da Ford e da Nissan (`npm run fichas:sites`) faltam as versões sem página de
  versão: Ranger XL (página sem linhas) e Raptor, Maverick, Territory, Bronco Sport, Mustang,
  F-150 Tremor, Frontier e Sentra; e as Transit que a FIPE não separa (Furgão Longo 380L/400L,
  Minibus Vidrada 440E L4H3). A Renault `especificacoes.html` não traz o que as planilhas já dão. As da VW são de 2017–2020 e o menu público só
  tem os modelos atuais. Pagas: JATO (Carspecs), Suiv.
- Folhetos da Renault que faltam: a Master 2022 (a FIPE não diz L1H1/L2H2/L3H2, só "Furgão",
  "Extra", "Grand"), o Kwid E-Tech (o folheto de 2023/2024 não diz a versão, e a FIPE só tem o
  Techno de 2025) e os antigos em `www.cdn.renault.com` (Clio, Fluence, Sandero 2019, Oroch,
  Kangoo, Master), que não respondem mais.
- Wayback, o que não deu: o Yaris 2020 (11 colunas de versões e o cabeçalho com só 7 nomes), o
  Civic G10 (é um catálogo de acessórios, com códigos de peça), os folhetos da Honda só em imagem
  (CR-V, ZR-V, Accord, Civic 2023 e Type R) e os PDFs da Hyundai que o arquivo guardou danificados.
- Web Worker para expandir e filtrar o índice: medido de novo em 09/11/2026 com 50.969
  versões-ano, não compensa. Expandir leva ~230 ms uma vez, ao carregar; filtrar + contar facetas +
  agrupar os 30.605 carros caiu de 130–150 ms para 51–59 ms (facetas contadas numa passada só, um
  `Intl.Collator` no lugar de `localeCompare`). Medir de novo se passar de ~100 ms.
- Chunk principal (292 KB, 92 KB com gzip): quase todo React DOM; só mexer se aparecer algo pesado.

## Futuro

- Domínio próprio para o site (hoje em carro-na-tela.agimenescomercial.workers.dev): o cache
  das respostas da FIPE no Worker só vale num domínio próprio.
- Conta para sincronizar os favoritos entre aparelhos: login pelo Cloudflare Access (código por
  e-mail, grátis até 50 usuários) e os favoritos numa tabela do D1, por rotas `/api/favoritos` no
  Worker; os do navegador sobem no primeiro login. Depois, aviso quando um favorito mudar X% na FIPE.
- Teste de ponta a ponta da Consulta (consulta → comparar), com as respostas da FIPE simuladas
  (`page.route("**/api/fipe/**")`); o do catálogo já existe (`npm run test:e2e`, só local: na CI
  não, por decisão de 10/11/2026).
- APIs pagas de consulta por placa (exige backend e atenção à LGPD).

## Concluído

- [x] Foto cortada da Toyota (`Toyota/00007-Toyota-corolla-cross-5-2-…jpg`): o original no site
      (toyotacomunica.com.br, uploads/2021/03/corolla-cross-5-2.jpg) já vem cortado do mesmo jeito, e
      a foto fica fora de `fotos.json`; não há outra cópia para baixar.
- [x] Teste de ponta a ponta do catálogo (`npm run test:e2e`, Playwright no Chrome instalado,
      `e2e/catalog.e2e.ts`): busca nas motos → página da versão → voltar com a busca mantida;
      link direto da versão; comparar duas e tirar uma; favorito que fica depois de recarregar;
      chip da busca; chassi decodificado pela tabela local. Roda sem rede: outros hosts são
      bloqueados e a API da FIPE responde 503. O servidor do teste tem cache próprio do Vite
      (`E2E_CACHE_DIR`), porque dividir o do `npm run dev` fazia um reotimizar o do outro e travar.
- [x] Motos de outras marcas no Wikidata (10/11/2026): Dafra pela SYM (Joyride, Maxsym) e TVS,
      Kasinski pela Hyosung (Comet GT 650 = GT650, RX 125); 1.327 motos com modelo.

- [x] Equipamentos dos releases da Volkswagen: a leitura guarda o texto inteiro (os `templates` da
      API, não só o resumo), e as 42 notícias com preço e itens de série de Tera, T-Cross, Nivus,
      Polo e Virtus foram lidas à mão: 33 listas (lançamentos de 2017 a 2025), as de oferta, marco e
      prêmio de fora; depois as de Taos, Jetta (e GLI), Amarok, Saveiro, Polo GTS e Track, Novo
      Virtus e T-Cross 2022: mais 35. Equipamentos em 295 versões (eram 249). As miniaturas da galeria deixam de
      repetir a chave (as fotos de imprensa de uma marca têm o mesmo link).
- [x] Fotos de imprensa no site: 943 fotos de 69 modelos de 10 marcas (Chevrolet, Citroën, Fiat,
      Ford, Jeep, Peugeot, Ram, Renault, Toyota, Volkswagen), com o crédito de cada marca, na frente
      das do Commons. Um arquivo corrompido fica de fora (e é listado) em vez de parar a leitura.
- [x] Revisão do modelo e do ano das fotos de imprensa: "turbo", "prévia" e "prêmio" não bastam
      para um modelo (a Pulse Turbo 200 ia para o Uno Turbo, um Corolla para o Previa), "500.000
      Toro" é a Toro, "2048x1365" não é ano, as de premiação ficam de fora, e a linha da FIPE acha o
      modelo que o rótulo não diz (as 32 da Ram 2500 vão para "Ram pickup", as da F-150 para a F-Series).
- [x] Fichas da Stellantis sem ano na página: o ano vem do título ("– 27/27", "AT8 202 4") ou, sem
      nenhum, da data em que o PDF entrou no site (o nome do arquivo termina no `uniqid` do PHP), ela e
      a seguinte (Nova Dakota, Rampage flex, Ram 2500/3500, Leapmotor, Jumpy e Expert 2.2). O ano da
      ficha vale mais que o da página ("MY25" numa página "2020 a 2024"); "Ram 1500" é linha, não
      ano; o PDF partido ("P eugeot A llure T urbo", "L IMITED T2 0 0") é emendado; o Hurricane é
      turbo; a Ram leva turbo e câmbio em aberto (a FIPE não diz); o "Aircross Feel 7" é o AIRCROSS7.
      Anos-modelo de 2019 em diante sem ficha: de 765 para 648 (de 1.195).
- [x] Cilindrada das motos em cc: do "150cc" do nome ou, sem ele, do número do modelo ("CB 650F",
      "R 1250 GS"), que é a cilindrada nominal; ficam de fora watts ("3000W"), aniversários ("115th",
      "50 Anos") e o 946 da Vespa. 790 de 979 motos têm; o filtro de cilindrada aparece nas motos, em
      classes de 50 a 1.800 cc, e os cartões mostram "650 cc".
- [x] Equipamentos citados nos releases (`npm run crawl:releases`, `extract:equipamentos`): cada
      versão com preço ("Citroën C3 Live Plus – R$ …") e seus itens em lista, herdando os da versão
      de que diz partir ("Todos os itens da versão Live Go mais:"). Revisados 120 de 2021 em diante
      (104 aceitos, 16 rejeitados: preços, condições de venda, blocos com várias versões); entram só
      onde não há lista da sala de imprensa e aparecem como "Release da Stellantis". Equipamentos em
      231 versões (eram 225), agora também de Citroën, Fiat, Jeep, Peugeot e RAM. De quebra: o
      "T270"/"TD380" da Stellantis conta como turbo, o "208"/"2008"/"3500" como nome da linha, e uma
      ficha sem nenhum número em comum não aparece; 727 fichas casadas com 1.452 anos-modelo (eram
      700 e 1.415).

- [x] Escolha Carros / Motos / Caminhões no catálogo (`?categoria=`; `tipo=` é da Consulta FIPE): a
      lista, os filtros, as contagens e o cabeçalho são da categoria; os filtros que só valem para
      carros (carroceria, cilindrada em litros, porte, portas, consumo, conforto) somem nas outras. A
      busca pelo chassi abre a categoria do fabricante (WMI "Honda Motorcycles" → motos), e o
      `fetch:wmi` casa também as marcas de motos e caminhões.
- [x] Manuais antigos da Renault: o Fluence de 2010 a 2013 tem texto, mas em versaletes partidos
      ("c | ilindrada", "1 | 998"), que agora se juntam; nos Logan de 2008 a 2012 o expoente de
      "(cm³)" virava uma coluna e o "998" ficava 4 pontos abaixo da linha. Com isso entram também o
      Captur 2016, o Sandero e o Logan 2017, o Kwid 2018 e a Master 2013: 180 fichas de manual (eram
      158), 700 fichas casadas com 1.415 anos-modelo (eram 689 e 1.385).
- [x] Manuais do proprietário da Renault (`npm run fichas:manuais`, depois `fichas:abertas`): 116 PDFs
      de 2008 a 2025 nas páginas `/manuais/<modelo>.html`; o capítulo "Características técnicas" dá
      potência, torque, cilindrada, peso e, quando o desenho é de uma versão só, comprimento e
      entre-eixos. 158 fichas (Master e Fluence incluídos) dão números a 119 versões a mais (433
      anos-modelo), só onde não há ficha da sala de imprensa. A potência em kW vira cv, e uma em kW rotulada como cv (Logan 2013)
      é corrigida pelo mesmo motor de um ano vizinho.
- [x] Fichas e equipamentos dos sites da Ford e da Nissan (`npm run fichas:sites`): a Ford tem
      uma página por versão (`compare-as-versoes/<versão>.html`), ligada à versão FIPE à mão em
      `scripts/fichas/ford.ts`; a Nissan põe todas as versões num JSON do `compare.html`, com o ano
      ("Ano de produção 2026/2027") e os opcionais. Entram 20 versões da Ford (Ranger Black, XLS,
      XLT, Limited, F-150 Lariat, Transit, E-Transit) e 15 da Nissan (Kait, Kicks 2026 e 2027,
      Versa). O câmbio "DCT"/"dupla embreagem" agora conta como automático.
- [x] Fichas e equipamentos dos sites da Kia e da GWM (`npm run fichas:sites`, depois
      `fichas:abertas`): a Kia põe tudo em HTML por código de versão (`N.855.2627`: anos 26/27), a
      página do modelo dá o nome; a GWM tem uma página por versão, ligada à versão FIPE à mão. Entram
      as 10 versões da Kia à venda (Bongo, Carnival, EV5, EV9, Niro, Sorento, Sportage, Stonic,
      Tasman) e 7 da GWM (Haval H9, Tank 300, Wey 07, Ora 5). Faltam as páginas que a GWM tirou do ar
      (Haval H6, Poer P30) e o Ora 03, cuja página não diz a versão; os PDFs da Kia não foram lidos.
- [x] Wayback Machine, o que sobrou: as listas da Toyota que o leitor não lia têm marcas, só outras
      ("O" no Yaris 2023, um caractere de fonte de símbolos no Camry 2023) e cabeçalho sem "Versão";
      agora entram Yaris 2023 hatch e sedã (XL, XS, XLS) e Camry Hybrid 2023. A do RAV4 2023 já
      entrava. Equipamentos em 309 anos-modelo de 121 versões. Ficaram sem fonte (ver abaixo) o
      Yaris 2020, o Civic G10, os folhetos da Honda só em imagem e os PDFs danificados da Hyundai.
- [x] Levantamento dos sites das marcas (30/10/2026): Toyota, Honda, Caoa Chery, Audi e Volvo
      respondem 403 a um acesso comum (não contornar); VW, Chevrolet, Hyundai, Renault, Nissan, Ford,
      Mitsubishi, Kia, BYD, GWM e BMW abrem, sem robots.txt que proíba tudo. As que dão fichas
      viraram o item "Fichas nos sites das marcas que abrem".

- [x] Latin NCAP por geração: o teste não passa por quatro anos ou mais em que a versão saiu da FIPE
      (voltou como outra geração, como o WR-V de 2026, que mostrava o teste de 2022 do anterior).
      As gerações do Wikidata não serviram: incluem as de outros mercados (Sandero III, Duster III,
      C3 europeu) e tiravam testes certos de 429 anos-modelo.
- [x] Folhetos da Renault que listam em texto (`brochureBullets`): Logan 2024 (Life e Zen) e Captur 2021
      (Zen e Intense), com a versão de cima somando a de baixo ("além da Life…", "série ZEN e ainda").
- [x] Fase 4, fichas e equipamentos de outras marcas: ver o item abaixo; o que não tem fonte ficou em
      "Sem fonte aberta ou sem ganho por enquanto".
- [x] Equipamentos e fichas de outras marcas: Toyota (59 PDFs de 2018–2025) e Hyundai (catálogos por
      versão de HB20, HB20S, Creta, Kona… de 2024–2026) pelo Wayback Machine (`npm run fichas:wayback`,
      `scripts/fichas/toyota.ts` e `hyundai.ts`, que também lê a tabela do Creta 25/26 com todas as
      versões), e as tabelas de equipamentos dos folhetos da Renault (Duster 2021 e 2025, Kwid 2024,
      Kangoo 2024, Stepway 2024, `scripts/fichas/renault-brochure.ts`; `fichas:renault` baixa os
      folhetos), e as tabelas de especificações dos folhetos da Honda (City 2014, 2015 e Hatchback
      2024, Civic 2015, 2020 e 2021, Fit 2015 e 2021, HR-V 2021 e 2026, WR-V 2019, 2021 e 2025,
      `scripts/fichas/honda.ts`). Fichas em 814 anos-modelo de 370 versões; equipamentos em 287
      anos-modelo de 112 versões.
- [x] Lugar para as fotos de imprensa autorizadas (`data/imprensa/fotos/<Marca>/`, fora do git, com
      `autorizacao.json`; `npm run fotos:imprensa` reduz e lista, e o `build:catalog` as põe na frente
      da galeria, com o crédito e o link da sala de imprensa). Falta preencher o crédito das marcas
      que autorizaram.
- [x] Segurança e seguro na ficha: estrelas da Latin NCAP da linha (`npm run fetch:latinncap`, 198 testes,
      do ano antes do teste a cinco depois) e seguro estimado e roubos por mil da SUSEP AUTOSEG
      (`npm run fetch:seguro`, 2021, por código FIPE; a taxa do prêmio sobre o valor segurado vai
      aplicada ao preço FIPE de hoje, com o fator do estado). Atualizar o AUTOSEG quando a SUSEP
      publicar semestres novos (`--periodo=`).
- [x] Fichas técnicas da Stellantis: lista dos 460 links, checklist numerada para baixar à mão, leitor
      dos PDFs (dois formatos) e casamento com as versões FIPE; 458 fichas lidas dão números exatos a
      263 anos-modelo de 120 versões, na ficha e no comparador.
- [x] Galeria de fotos na página da versão: até 8 fotos por geração do Wikimedia Commons, com ângulo
      (frente, traseira, lateral, interior), crédito e vista ampliada. 11.661 fotos de 548 modelos.
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
