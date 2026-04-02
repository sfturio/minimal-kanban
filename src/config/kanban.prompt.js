export const KANBAN_PROMPT_TEMPLATE = `Transforme a ideia abaixo em tarefas acionáveis para Kanban.

Regras:
- Separe tarefas usando ";"
- Comece com verbos (criar, implementar, corrigir, adicionar)
- Use:
  ! = alta prioridade (somente no inicio)
  [coluna] = define coluna de destino (ex: [em andamento])
  ( ) = categoria
  @ = responsável
  # = tags
  + = data (DD-MM-AAAA)
- Mantenha tarefas curtas
- Sem explicações

Exemplo:
![em andamento] corrigir bug login @joao #backend +05-04-2026

Ideia:
`;
