# Minimal Kanban

Kanban pessoal frontend-only feito com HTML, CSS e JavaScript vanilla.

## Funcionalidades

- Multiplas tabelas (boards): criar, renomear, excluir, alternar
- Multiplas colunas por tabela: criar, renomear, excluir
- Tarefas com:
  - titulo
  - categoria
  - responsavel
  - tags
  - data
  - finalizado em
  - prioridade
  - comentarios
- Drag and drop entre colunas
- Modo foco
- Tema dark/light
- Planejamento com IA (input curto)
- Backup e importacao via JSON
- Persistencia local (`localStorage`)

## Parsing de tarefas

Comandos suportados:

- `;` separa tarefas
- `!` envia para Em andamento
- `!!` define prioridade alta
- `(categoria)` define categoria
- `@responsavel` define responsavel
- `#tag` adiciona tag
- `+data` ou `*data` define data

Exemplo:

```text
!criar API (manha) @joao #backend +05042026; !!revisar fluxo de caixa (financeiro) @ana #urgente +07-04-2026
```

## Arquitetura (ES Modules)

```text
minimal-kanban
├─ index.html
├─ style.css
└─ src/
   ├─ app.js
   ├─ config/
   │  └─ kanban.prompt.js
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
2. Ou rode com Live Server para desenvolvimento.

## Stack

- HTML
- CSS
- JavaScript (Vanilla + ES Modules)
