# Mudanças

Registra principalmente mudanças de **regra de cálculo** (versão em `VERSAO_REGRA`, `src/lib/calculo/motor.ts`) e de comportamento que o cliente percebe.

## Fase 2 (13/11/2026)

### Regra de cálculo

- **Versão da regra continua `IN05-2017-AnexoVII-D/v1`** para todos os motivos existentes: nenhum número muda.
- **Novo motivo "Mudança de lei: jornada (EC 141/2026)"**, com regra própria e escolha obrigatória de cenário em cada pedido:
  - manter as horas de serviço: linhas em R$ da planilha atual × jornada antes ÷ jornada depois (44 ÷ 40 = 1,10); percentuais e tributos acompanham pelo motor;
  - reduzir as horas: valor mensal igual, horas por posto reduzidas na proporção.
  Datas da emenda em configuração, a confirmar com o jurídico. Os dados da jornada e o cenário entram na assinatura do cálculo.
- **Leitura da convenção com IA**: a IA só sugere; o número que entra é o que a pessoa confirmou, com a cláusula e a página como fonte.

### Comportamento

- Celular: barra com Pedidos e "Mais"; Hoje compacto; passos com barra de progresso; memória por cartão e por módulo.
- Carteira em 5 colunas, filtro "Afetados pela jornada de 40 horas" e pedidos da jornada em lote.
- Recurso depois do indeferimento e novo pedido a partir dele; documentos com versão; Recuperado com a Equapar; histórico do órgão na conta.
- Raio-X com valor global do PNCP e tempo até o fim da vigência (sem estimativa).
- Painel interno: custo de aquisição, margem, minutos de trabalho humano e pesquisa de Sean Ellis.

## Branch `produto-pronto` (12/11/2026)

### Regra de cálculo

- **Versão da regra continua `IN05-2017-AnexoVII-D/v1`**: nenhum número muda com o padrão.
- **L11**: o retroativo ganhou opções por pedido, todas desligadas por padrão:
  - "Data final da contagem": data informada (padrão), data do protocolo ou data do apostilamento;
  - "Mês incompleto": dias corridos (padrão) ou mês de 30 dias.
  A escolha aparece na memória, no PDF e no ofício e entra na assinatura do cálculo só quando difere do padrão.
- **C2.3**: a aprovação da memória guarda a assinatura (SHA-256) da base do cálculo; mudar a base desfaz a aprovação.
- **C3**: a diferença gravada para listas e painéis é recalculada a cada mudança, igual à dos documentos.

### Comportamento

- Fase 0 completa: 8 falhas bloqueadoras (C1–C8), 12 itens de segurança (S1–S12) e 17 de lógica (L1–L17). Ver `docs/produto-pronto/RELATORIO.md`.
- Fase 1: armazenamento S3, saúde, logs com id da requisição, alerta de erro, painel interno, documentação.

## Redesenho de UX (`redesenho-ux`)

Sem mudança de regra de cálculo. Ver `docs/redesenho/RELATORIO.md`.
