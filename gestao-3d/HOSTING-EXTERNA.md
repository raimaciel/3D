# Gestão 3D — pacote para hospedagem externa

Este pacote contém o código-fonte da versão atual do Gestão 3D, em português e responsivo para computador e celular.

## O que está incluído

- Código-fonte completo do sistema;
- Configuração e migração inicial do banco;
- Regras de precificação, pedidos, produção, estoque e financeiro;
- Upload de fotos e logo da empresa;
- Manual de uso em `docs/Manual_de_Uso_Gestao_3D.docx`.

## Requisitos

- Node.js 22 ou superior;
- pnpm 11 ou superior;
- Hospedagem compatível com Cloudflare Workers/Vinext;
- Banco Cloudflare D1 com o binding `DB`;
- Armazenamento Cloudflare R2 com o binding `BUCKET`.

O sistema não é uma aplicação PHP de hospedagem compartilhada. Em Hostinger/cPanel comum ele não funcionará sem adaptação.

## Instalação básica

```bash
pnpm install --frozen-lockfile
pnpm build
```

Antes da publicação, configure no provedor:

1. Um banco D1 para o binding `DB`;
2. Um bucket R2 para o binding `BUCKET`;
3. A migração `drizzle/0000_small_solo.sql` no banco;
4. HTTPS e controle de acesso para impedir que os dados fiquem públicos.

Os nomes dos bindings precisam continuar exatamente como `DB` e `BUCKET`, porque o código utiliza esses nomes.

## Atenção sobre segurança

No Sites original, o acesso privado era controlado pela própria plataforma. Ao levar este projeto para outro provedor, essa proteção não é transferida automaticamente. Não publique o sistema aberto na internet antes de configurar autenticação e autorização.

## Dados já cadastrados

Os dados atuais não ficam dentro deste arquivo ZIP. Eles estão no banco da hospedagem original.

No sistema atual, use **Configurações → Backup dos seus dados → Exportar dados** para guardar um JSON com clientes, materiais, produtos, orçamentos, pedidos, estoque e financeiro. As fotos e a logo ficam armazenadas separadamente no R2.

A versão atual possui exportação, mas não possui importação automática. Para migrar os dados para outro banco, será necessário criar uma rotina de importação ou fazer a migração diretamente no D1.

## Arquivo específico do Sites

O arquivo `.openai/hosting.json` foi preservado para manter a origem e as configurações do projeto. Em outro ambiente, substitua o `project_id` e configure os bindings do novo provedor conforme a documentação dele.
