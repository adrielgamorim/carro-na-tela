# Fotos de imprensa autorizadas

Fotos que as marcas autorizaram a mostrar na galeria da versão. Os originais ficam só aqui,
fora do git (`.gitignore`); `npm run fotos:imprensa` grava as versões menores em
`public/catalog/imprensa/` e a lista em `data/imprensa/fotos.json`, e o `build:catalog` põe
essas fotos na frente das do Wikimedia Commons.

## Como organizar

```
data/imprensa/fotos/
  Renault/
    autorizacao.json        ← obrigatório (copie o de _exemplo)
    Duster 2025/
      frente.jpg
      traseira.jpg
      interior painel.jpg
    Kwid 2023-2025/
      ...
  Volkswagen/
    autorizacao.json
    Polo 2024/
      ...
```

- **Pasta da marca**: o nome da marca como na FIPE ("Renault", "Volkswagen", "Chevrolet", "Fiat").
- **`autorizacao.json`**: `credito` (aparece embaixo da foto, ex.: "Renault do Brasil / Divulgação")
  e `link` (a sala de imprensa, link da foto) são obrigatórios; `autorizadoEm`, `contato` e
  `condicoes` são para o nosso registro. Sem ele, a pasta é ignorada.
- **Modelo e ano**: no nome da subpasta ou do arquivo: "Duster 2025", "Kwid 2023-2025",
  "duster-oroch-2024-frente.jpg". O ano é o ano-modelo em que a foto aparece; uma faixa
  ("2023-2025") vale para todos os anos dela, e "my26" vale 2026. Sem ano, a foto vai para a
  geração mais nova do modelo.
- **Arquivos baixados** ("00150-Jeep-Commander-Renegade_700mil-0539ebec7253.jpg": número, marca,
  linha, nome original, hash) podem ficar soltos na pasta da marca: vale o modelo do nome
  original e, sem ele, o da linha.
- Ficam de fora: fotos com menos de 600 px de largura, cópias exatas e as de corrida, evento,
  logo ou conceito (pelo nome). `npm run fotos:imprensa -- --previa` mostra o que entraria, por
  marca, sem gravar nada.
- **Ângulo**: pelo nome do arquivo: frente/frontal/dianteira, traseira, lateral/perfil,
  interior/painel/bancos/volante. Sem nenhum, a foto vai para o fim.
- Formatos: JPG, PNG, WebP ou TIFF.

Depois de colocar as fotos:

```bash
npm run fotos:imprensa
npm run build:catalog
```

O primeiro lista as fotos que ficaram de fora e por quê (modelo não reconhecido, sem ano).
