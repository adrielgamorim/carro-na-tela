# Plano — Catálogo com busca avançada

Objetivo: busca no estilo da [busca avançada do Carros na Web](https://www.carrosnaweb.com.br/avancada.asp)
(fabricante, modelo, faixa de ano, faixa de preço, configuração, propulsão, câmbio etc.)
usando apenas fontes gratuitas.

Pesquisa feita em 26/out/2026.

---

## 1. O que o Carros na Web oferece

O formulário (`catalogo.asp`, GET) tem cerca de 45 filtros e 67 equipamentos.
A página de resultados redirecionou para `erro.asp` (provável bloqueio por volume), então só o formulário foi analisado.

| Grupo | Filtros |
|---|---|
| Básico | fabricante, modelo, ano inicial/final, preço mín/máx, configuração (Hatch, Sedã, Perua, Minivan, Van, SUV, Jipe, Picape, Cupê, Conversível, Furgão, Chassi-cabine, Buggy), procedência (nacional/importado), só 0-km, só vendidos no Brasil |
| Propulsão / energia | propulsão (Combustão, Híbrido leve, Híbrido pleno, Híbrido plug-in, Elétrico), combustível, consumo urbano/estrada mín., autonomia cidade/estrada, tanque |
| Carroceria | porte (Subcompacto → Grande), portas, passageiros, porta-malas, peso, altura do solo, Cx |
| Motor | cilindrada mín/máx, potência mín., torque mín., relações peso/potência e peso/torque, cilindros (quantidade e disposição), válvulas, aspiração (natural/turbo/compressor), alimentação, comando, variador de fase, tuchos |
| Transmissão | câmbio (manual/automático), marchas, embreagem/tipo (DCT, CVT, conversor de torque…), tração |
| Chassi | suspensões, freios, direção, flanco do pneu |
| Equipamentos | 67 caixas: airbags, ESP, AEB, câmera 360, ACC, CarPlay, teto solar… |
| Ordenação | 40 opções: preço, potência, consumo, aceleração, desvalorização, "índice CNW"… |

A maior parte disso (potência, torque, dimensões, suspensão, equipamentos) é **base curada própria** do site.
Não existe API gratuita com esse nível de detalhe para o mercado brasileiro, então o plano cobre o que
dá para obter de graça e deixa o resto como curadoria opcional (fase 4).

## 2. Fontes gratuitas avaliadas (testadas)

| Fonte | Traz | Acesso | Veredito |
|---|---|---|---|
| **FIPE — Parallelum v2** (já usada) | marca, modelo/versão, ano-modelo, combustível, preço mensal, histórico | REST, CORS ok. **500 req/dia sem token** (header `x-ratelimit-limit: 500`), mais com token gratuito | Base do catálogo e do preço |
| **Nome do modelo FIPE** (parsing) | cilindrada, válvulas, portas, câmbio (`Aut.`, `CVT`, `Mec.`), turbo (`TB`, `Turbo`, `TSI`), tração (`4x4`, `AWD`), cabine (`CD`, `CS`), `Hybrid`, `Elétrico` | Grátis, sem requisição extra | Muito útil: extrai atributos de câmbio, motor e carroceria a partir do nome |
| **INMETRO PBEV** (tabelas 2009–2026) | categoria/porte (Sub Compacto, Compacto, Médio, Grande, Utilitário Esportivo Compacto/Grande, Picape, Minivan, Comercial, Fora de Estrada, Esportivo), marca, modelo, versão, motor, **tipo de propulsão** (Combustão, Híbrido, Plug-in, Elétrico), **transmissão + marchas** (M-5, A-6, CVT-7, DCT, MTA), ar-condicionado, direção (H/M/E/EH), combustível, **consumo cidade/estrada** (gasolina, etanol, diesel, elétrico), autonomia EV, emissões, notas PBE/CONPET | PDF anual oficial. 2026 = **976 versões / 43 marcas** (186 elétricos, 112 plug-in, 114 híbridos, 310 flex, 320 gasolina, 144 diesel) | Principal fonte de especificações. Exige ETL do PDF (testado: o texto extrai bem com `pdfjs-dist`) |
| **Wikidata / Commons** | ID do modelo, **foto**, ano de lançamento | SPARQL grátis, CORS ok | Bom para imagens. Testado: Argo, Pulse, Onix, HB20 e T-Cross têm foto. Carroceria (`P3003`) e tração (`P3434`) quase sempre vazias |
| **RENAVAM / Senatran** (dados.transportes.gov.br) | frota por UF/município/marca/modelo, mensal | CSV/ZIP (~110 MB/mês), domínio público | Opcional: ranking de "mais populares" |
| BrasilAPI FIPE | marcas, preço por código FIPE | Grátis | Instável: preço retornou "temporariamente indisponível" no teste. Só como fallback |
| CarAPI (carapi.app) | trims, motor, carroceria (mercado EUA) | 1.000 req/dia grátis, **sem CORS** | Descartado: versões americanas não correspondem às brasileiras |
| NHTSA vPIC / fueleconomy.gov | decodificador de VIN, consumo (EUA) | Grátis | Descartado para o catálogo (só EUA). vPIC pode servir depois para busca por chassi |
| Scrapers (Webmotors, OLX, Carros na Web) | anúncios, fichas | Pagos ou contra os termos de uso | **Não usar** |

## 3. Cobertura dos filtros desejados

| Filtro | Fonte | Fase |
|---|---|---|
| Fabricante, modelo, versão | FIPE | 1 |
| Faixa de ano | FIPE (ano-modelo) | 1 |
| Faixa de preço | FIPE (preço da referência atual) | 1 |
| Combustível | FIPE | 1 |
| Câmbio manual/automático | Nome FIPE → PBEV confirma | 1 → 2 |
| Cilindrada, válvulas, turbo, portas, 4x4, cabine | Nome FIPE | 1 |
| Configuração (Hatch, Sedã, SUV, Picape…) | Categoria PBEV + palavras do nome (`Sedan`, `CD`, `Furgão`) + tabela manual por família de modelo | 2 |
| Porte | Categoria PBEV | 2 |
| Propulsão (combustão, híbrido, plug-in, elétrico) | PBEV + nome FIPE (`Hybrid`, `Elétrico`) | 2 |
| Nº de marchas, tipo de câmbio (CVT, DCT, AT) | PBEV | 2 |
| Consumo urbano/estrada, autonomia EV | PBEV | 2 |
| Direção, ar-condicionado | PBEV | 2 |
| 0-km / vendido atualmente | FIPE (ano `32000` = 0 km) + presença no PBEV do ano | 2 |
| Foto | Wikidata/Commons | 3 |
| Popularidade | RENAVAM | 3 |
| Potência, torque, dimensões, porta-malas, peso, equipamentos | Sem fonte gratuita confiável → curadoria manual/comunitária | 4 (opcional) |

## 4. Arquitetura

### Por que um índice pré-construído
Filtrar "todos os SUVs automáticos de R$ 80–120 mil, 2020–2024" não dá para fazer consultando a FIPE ao vivo:
a API exige navegar marca → modelo → ano → detalhe, e o limite é de 500 requisições por dia.
A solução é um **índice estático** (JSON) gerado por script e filtrado no navegador.

```
scripts/catalog/
  crawl-fipe.ts        # varredura incremental com cache em disco; retoma de onde parou
  parse-pbev.ts        # PDF → JSON (pdfjs-dist, colunas pela posição x)
  parse-model-name.ts  # "1.3 TB Flex Aut. 4p" → { engine: 1.3, turbo, automatic, doors: 4 }
  match.ts             # FIPE ↔ PBEV por marca + modelo + versão + motor + ano → { confidence }
  build-index.ts       # gera public/catalog/*.json
data/
  pbev/2026.json …     # versionado
  overrides/body-types.json   # família → configuração (ex.: "Pulse" → SUV)
public/catalog/
  index.json           # facetas + linha compacta por versão-ano
  prices-<ref>.json    # preço por (codeFipe, ano) na referência
```

- **Crawl FIPE** (implementado: `npm run crawl:fipe`). Percorre marca → ano → modelos do ano → detalhe, do ano mais novo para o mais antigo. Cada resposta fica em cache em disco, e a execução retoma de onde parou.
  - **Limites confirmados:** 500 req/dia sem token (`x-ratelimit-limit`); 1.000/dia com a chave gratuita (FAQ de fipe.api.br); o plano Pro não tem limite diário. A recomendação é 50–60 req/min.
  - **Tamanho estimado:** só a Fiat tem 68 códigos ano-combustível de 2009 em diante, com 30–100 modelos cada (2024 Flex: 32; 2015 Flex: 98), ou seja, alguns milhares de detalhes. O catálogo completo de carros 2009+ deve somar dezenas de milhares de requisições: cerca de 1–2 meses com a chave gratuita.
  - **Estratégia:** começar pelo 0 km e pelos últimos ~8 anos das ~20 maiores marcas, que é o que a maioria busca. Rodar diariamente (GitHub Action com o token em secret) até completar. Nas referências seguintes, atualizar primeiro os anos recentes.
- **Escopo inicial:** só carros (sem motos e caminhões), anos-modelo de 2009 em diante (cobertura do PBEV).
- **Tamanho:** cerca de 40 mil linhas versão-ano, aproximadamente 1–2 MB gzip com chaves curtas.
  Se crescer, fatiar por marca ou migrar para SQLite-wasm/DuckDB-wasm.
- **No cliente:** `services/catalog.ts` carrega o índice uma vez e aplica filtros e facetas em memória,
  com contagem por opção. O código atual de `filterVehicles` vira a base disso.
- **Correspondência FIPE ↔ PBEV:** os nomes não batem 1:1 (FIPE: `Argo Drive 1.3 8V Flex Aut.`; PBEV: `ARGO / DRIVE 1.3 AT / 1.3-8V / CVT-7`).
  Normalizar marca, família e motor, comparar tokens da versão e guardar `confidence: exact | fuzzy | none`.
  Na interface, dado "fuzzy" aparece com indicação "aproximado".
- **Proxy (já no TODO):** passa a ser necessário só para consultas ao vivo com token. O catálogo é estático.

### Tipos novos (resumo)
```ts
interface CatalogEntry {
  id: string;              // codeFipe:yearCode
  brand: string; family: string; version: string;
  modelYear: number; zeroKm: boolean;
  fuel: Fuel; price: number;
  bodyType?: BodyType;     // hatch | sedan | suv | picape | …
  size?: SizeClass;        // PBEV
  propulsion?: "combustao" | "hibrido" | "hibrido-plugin" | "eletrico";
  transmission?: { kind: "manual" | "automatico" | "cvt" | "dct" | "automatizado"; gears?: number };
  engine?: { liters?: number; valves?: number; turbo?: boolean };
  doors?: number; drive4x4?: boolean;
  consumption?: { city?: number; highway?: number; fuel: "gasolina" | "etanol" | "diesel" | "eletrico" };
  imageUrl?: string;
  sources: { field: string; source: "fipe" | "fipe-name" | "pbev" | "wikidata"; confidence: "exact" | "fuzzy" }[];
}
```

## 5. Nova UI/UX

O app hoje é uma consulta FIPE linear (5 selects em cascata). A proposta é transformá-lo em três áreas,
mantendo a identidade visual atual (tipografia, cores, cards):

```
┌ Topbar: Catálogo | Consulta FIPE | Comparador (n) ───────────────────────┐
│ [ Buscar "SUV automático até 120 mil"… ]                                 │
├───────────────┬──────────────────────────────────────────────────────────┤
│ FILTROS       │ 1.248 versões · ordenar [Menor preço ▾]  [grade|lista]   │
│ ▸ Essenciais  │ chips: SUV ✕  Automático ✕  R$ 80–120 mil ✕  Limpar      │
│   Marca  ☐☐☐  │ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│   Ano  ●──●   │ │  foto    │ │  foto    │ │  foto    │                   │
│   Preço ●──●  │ │ Pulse    │ │ T-Cross  │ │ Creta    │                   │
│   Configuração│ │ Drive 1.3│ │ 200 TSI  │ │ 1.0 TGDI │                   │
│   [Hatch][SUV]│ │ R$ 98 mil│ │ R$ 115 mil││ R$ 119 mil│                  │
│ ▸ Motor e     │ │ CVT·Flex │ │ AT6·Flex │ │ DCT·Flex │                   │
│   câmbio      │ │ 13,5 km/l│ │ 12,1 km/l│ │ 11,9 km/l│                   │
│ ▸ Consumo     │ │ [+ comparar]           │                               │
│ ▸ Carroceria  │ └──────────┘ └──────────┘ └──────────┘                   │
├───────────────┴──────────────────────────────────────────────────────────┤
│ Bandeja do comparador: [Pulse ✕] [T-Cross ✕]  → Comparar lado a lado     │
└──────────────────────────────────────────────────────────────────────────┘
```

Escolhas de UX em relação ao Carros na Web:
1. **Facetas com contagem** (`SUV (312)`) em vez de dropdowns cegos. Opções que zeram o resultado ficam desabilitadas, então nunca se chega a uma busca vazia por acidente.
2. **Range sliders com inputs** para ano, preço, consumo e cilindrada, no lugar de pares de selects com valores fixos.
3. **Configuração e propulsão como botões com ícone** (Hatch, Sedã, SUV, Picape…; Combustão, Híbrido, Plug-in, Elétrico), que são os filtros mais usados.
4. **Grupos recolhíveis.** "Essenciais" vem aberto; Motor, Consumo e Carroceria ficam recolhidos. Isso evita a parede de 45 campos.
5. **Chips de filtros ativos** com remoção individual e "Limpar tudo"; resultado atualizado ao vivo, sem botão "Buscar".
6. **Filtros na URL** (`?marca=fiat&config=suv&preco=80000-120000`), para compartilhar, voltar e favoritar.
7. **Agrupar por modelo:** um card por versão com seletor de ano dentro dele, para evitar 15 cards do mesmo carro.
8. **Comparador como bandeja fixa** embaixo e página dedicada com tabela de atributos (preço, câmbio, consumo, porte), destacando o melhor de cada linha.
9. **Transparência dos dados:** selo "consumo INMETRO 2026", "atributo extraído do nome FIPE" e "aproximado" quando a correspondência for fuzzy.
10. **Mobile:** filtros em drawer (botão "Filtros (3)"), cards em lista.
11. **A "Consulta FIPE" atual continua** como aba, e o detalhe de um item do catálogo reaproveita `VehicleDetails` (histórico de preço).
12. **Ordenações úteis com os dados disponíveis:** menor/maior preço, mais novo, melhor consumo cidade/estrada, menor custo por km (consumo + preço ANP, fase 3) e maior desvalorização em 12 meses (histórico FIPE).

### Caminho híbrido (decidido em 26/out/2026)

A busca entre marcas precisa de um índice, porque a FIPE não tem endpoint de busca. Quase todo
o custo está nos preços, então o crawl foi dividido:

1. **Listagem** (marca → ano → modelos): todas as versões e anos em ~2–4 mil requisições
   (poucos dias com a chave gratuita). Dá nome, ano, combustível e os atributos do nome.
2. **Preços** (detalhe por versão-ano): começam quando a listagem termina, 0 km primeiro e
   depois anos mais novos, até completar (semanas).

Na interface, versões sem preço aparecem com "Consultar preço" (busca ao vivo, 1 requisição),
o filtro e a ordenação por preço consideram só as que já têm preço, e um aviso mostra a
cobertura. O `index.json` usa um formato compacto (v2) para caber o catálogo inteiro.

### Estado das fases (26/out/2026)

- **Fase 0:** concluída (testes do `useFipeCatalog`, reducer, abas e filtros na URL).
- **Fase 1:** código concluído, incluindo filtros de cilindrada e portas e busca nas listas de
  marcas e linhas. Dados: listagem em andamento (~1 dia de cota), preços depois (~2 semanas).
- **Fase 2 (INMETRO):** concluída para a tabela 2026 (968 versões; 721 versões FIPE recentes
  casadas, 524 exatas). Anos anteriores ficam para depois.
- **Fase 3 (fotos, custo por km, popularidade):** não iniciada.

### Estado da v1 (26/out/2026)

Implementado: abas na URL, facetas com contagem (marca, linha, propulsão, combustível, câmbio,
carroceria, turbo, 4x4, 0 km), faixas de ano e preço, chips de filtros ativos, filtros na URL,
cards agrupados por versão com seletor de ano, paginação, bandeja do comparador e gaveta de
filtros no mobile. Ainda não implementado: sliders (a v1 usa selects e campos numéricos), fotos,
comparador em tabela de atributos, detalhe do item dentro do catálogo.

## 6. Fases

| Fase | Entrega | Esforço |
|---|---|---|
| **0. Base** | Reducer + testes do `useFipeCatalog` (já no TODO), roteamento simples por abas e filtros na URL | P |
| **1. Catálogo FIPE** | `crawl-fipe` com cache, `parse-model-name` com testes, índice estático (escopo: carros, 2009+), página Catálogo com facetas (marca, modelo, ano, preço, combustível, câmbio, motor, portas, 4x4) | G |
| **2. INMETRO** | `parse-pbev` (2026 primeiro, depois anos anteriores), `match` FIPE↔PBEV, facetas de configuração, porte, propulsão, marchas, consumo, direção e ar; comparador em tabela | G |
| **3. Enriquecimento** | Fotos via Wikidata (gerado no build, não no cliente), custo por km (ANP), popularidade (RENAVAM), GitHub Action mensal | M |
| **4. Curadoria (opcional)** | `data/overrides/specs/*.json` para potência, torque, porta-malas e equipamentos dos modelos mais buscados, com contribuição via PR | contínuo |

## 7. Riscos e decisões em aberto

- **Limite da FIPE:** 500 req/dia sem token e 1.000/dia com a chave gratuita. O crawl completo leva semanas, então o escopo inicial precisa ser priorizado (ver seção 4).
- **Formato do PDF do PBEV muda a cada ano.** O parser precisa de testes com amostras de cada ano. Células vazias deslocam colunas no texto bruto, então ler as colunas pela posição x.
- **Correspondência fuzzy** pode atribuir câmbio ou consumo errado. Mostrar a fonte e a confiança, e manter uma tabela de overrides.
- **Configuração (hatch/sedã/SUV)** não vem pronta de nenhuma fonte gratuita. Ela vem da categoria PBEV mais uma tabela manual por família (algumas centenas de linhas).
- **Termos de uso:** não copiar dados do Carros na Web nem de outros sites. Fotos do Commons exigem atribuição da licença.
- **Hospedagem do índice:** começar estático (Vite `public/`). Se passar de alguns MB, avaliar shards ou SQLite-wasm.
