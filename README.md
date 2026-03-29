# Fluxo Essencial

Kanban pessoal, frontend-only, feito com HTML + CSS + JavaScript vanilla.

O foco do projeto é manter execução rápida no dia a dia, com visual limpo e recursos úteis sem dependência de backend.

## Funcionalidades

- Múltiplas tabelas (boards): criar, renomear, excluir, alternar
- Múltiplas colunas por tabela: criar, renomear, excluir
- Tarefas com:
  - título
  - categoria
  - responsável
  - tags
  - data
  - finalizado em
  - prioridade
  - comentários
- Drag and drop entre colunas
- Modo foco
- Tema dark/light
- Planejamento com IA (input em linguagem curta)
- Backup e importação via JSON
- Persistência local (`localStorage`)

## Parsing de tarefas (Planejar / entrada rápida)

Comandos suportados:

- `;` separa tarefas
- `!` envia para Em andamento
- `!!` define prioridade alta
- `(categoria)` define categoria
- `@responsavel` define responsável
- `#tag` adiciona tag
- `+data` ou `*data` define data

Exemplo:

```text
!criar API (manhã) @joao #backend +05042026; !!revisar fluxo de caixa (financeiro) @ana #urgente +07-04-2026
```

## Arquitetura (ES Modules)

```text
fluxo-essencial
├─ index.html
├─ style.css
├─ agents/
│  ├─ kanban.prompt.js
│  ├─ design-ui-designer.md
│  ├─ design-ux-architect.md
│  ├─ engineering-frontend-developer.md
│  └─ product-manager.md
└─ src/
   ├─ app.js
   ├─ state/
   │  ├─ app.state.js
   │  ├─ board.state.js
   │  └─ task.state.js
   ├─ services/
   │  ├─ board.service.js
   │  ├─ task.service.js
   │  └─ planner.service.js
   ├─ storage/
   │  └─ local.storage.js
   ├─ ui/
   │  ├─ dom.js
   │  ├─ board.render.js
   │  ├─ task.render.js
   │  └─ modal.ui.js
   ├─ features/
   │  ├─ dragdrop.service.js
   │  ├─ theme.service.js
   │  ├─ focus.service.js
   │  └─ backup.service.js
   └─ utils/
      ├─ parser.js
      ├─ date.js
      └─ helpers.js
```

## Como rodar

1. Abra o `index.html` no navegador.
2. Ou rode com Live Server para fluxo de desenvolvimento.

## Stack

- HTML
- CSS
- JavaScript (Vanilla + ES Modules)
