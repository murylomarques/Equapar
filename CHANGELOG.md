# Mudanças

Registra principalmente mudanças de **regra de cálculo** (versão em `VERSAO_REGRA`, `src/lib/calculo/motor.ts`) e de comportamento que o cliente percebe.

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
