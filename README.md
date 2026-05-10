# DS-Extractor (Frontend_Scan)

Ferramenta para extrair **Design Tokens** de URLs públicas com **Playwright**, clusterização em **Python (K-Means)** e exportação para `tokens.json`, `theme.css` e `tailwind.config.js` (pacote `@ds-extractor/style-export`). A **interface web** pede apenas o **URL do site**: extrai, mostra a demonstração dos tokens desse site e permite **descarregar o design system** em ZIP.

### Referência usada em uma extração
https://hajster.com/en

### Design gerado: 
<img width="1239" height="823" alt="image" src="https://github.com/user-attachments/assets/a0a428fc-788e-4b13-b950-254181190827" />

## Requisitos

- Node.js 18+
- Python 3 com dependências em `python/cluster/requirements.txt`
- Chromium do Playwright: `npx playwright install chromium`

## Interface (fluxo principal)

1. Na raiz do repositório:

```bash
npm install
pip install -r python/cluster/requirements.txt
npx playwright install chromium
npm run build
npm run dev
```

O comando **`npm run dev`** inicia em simultâneo a **UI (Vite, porta 5173)** e a **API local (Fastify, porta 3847)** com proxy dos pedidos `/api`.

2. Abra **http://localhost:5173**.
3. Introduza o **URL do site** (por exemplo `https://example.com`) e clique em **Extrair e demonstrar**.
4. Quando terminar, navegue pelas secções: tokens (Cores, Tipografia, Espaçamento com escala 4/8px sugerida em `dimension.suggested`), animações, **micro-interações** (probes de hover via Playwright), **live preview**, **prompt de referência** (texto narrativo para Cursor/Claude) e **árvore DOM** (mapa superficial truncado).
5. Clique em **Baixar design system (ZIP)** para obter a pasta `styles/` com `tokens.json`, `theme.css`, `tailwind.config.js` e **`reference-prompt.md`** (relatório heurístico).

Não existe fluxo de importação de JSON na interface; tudo parte do URL e do resultado devolvido pela API.

## Monorepo (`npm` workspaces)

| Pacote | Descrição |
|--------|-----------|
| `@ds-extractor/tokens-schema` | Tipos Zod / DTCG |
| `@ds-extractor/style-export` | Geração de artefactos a partir de tokens DTCG |
| `@ds-extractor/scanner` | CLI Playwright `ds-extract` |
| `@ds-extractor/ui` | Interface Vite + React |
| `@ds-extractor/server` | API local (`POST /api/scan`) |

## Fluxo em linha de comandos (alternativo)

```bash
npm run extract -- --url https://example.com --out raw-tokens.json --final-out final-tokens.json --styles-out out/styles
```

Flags úteis para SPAs:

- `--wait-until domcontentloaded|load|networkidle`
- `--wait-ms <n>` — espera extra após navegação (ms)
- `--selector-wait <css>` — aguarda um seletor antes do scan

Variável `PYTHON` aponta para o interpretador Python, se necessário.

## Smoke test

```bash
npm run smoke
```

Executa um scan mínimo de `example.com` e valida a geração de `final-tokens.json`.

## Testes unitários

```bash
npm run test -w @ds-extractor/style-export
```

## Publicação NPM (pacotes internos)

Cada pacote em `packages/*` pode ser publicado com `npm publish` após `npm run build`; use escopos (`@sua-org/...`) e `prepublishOnly` conforme a sua política.

## Licença

MIT — ver [LICENSE](LICENSE).
