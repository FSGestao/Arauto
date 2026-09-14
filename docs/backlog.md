# Backlog — Arauto

O que ficou de fora do núcleo de compartilhamento de informação ao vivo (que
está completo — ver `docs/prompt-nucleo-ao-vivo.md`), organizado por tipo.

---

## 1. Publicação / infraestrutura (não é código do app — é colocar pra rodar de verdade)

- [ ] **Publicar o `website/` no Vercel.** Hoje só roda localmente. Precisa:
  variáveis de ambiente de produção (`SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`,
  `JWT_SECRET`, SMTP), e colocar o `.exe` do app em `website/private/downloads/`
  depois de gerado.
- [ ] **Testar o instalador Windows de ponta a ponta.** `npm run electron:pack`
  gera o `.exe`, mas ninguém rodou a instalação real nem abriu o app já
  empacotado (o ambiente de desenvolvimento não roda instaladores). Testar em
  uma máquina limpa, sem Node/dependências instaladas.
- [ ] **SMTP real.** O fluxo de aprovação do site funciona sem SMTP (mostra a
  senha temporária na tela), mas em produção precisa de um provedor de e-mail
  de verdade (Gmail, SendGrid, etc.) configurado.
- [ ] **Apagar `prisma/`.** Resquício do scaffold original (Prisma/SQLite,
  substituído por JSON). O arquivo `dev.db` está travado por outro processo
  neste ambiente — reiniciar a máquina e apagar a pasta manualmente resolve.

## 2. Conteúdo de teste

- [ ] **Vídeo de exemplo real.** A biblioteca de mídia tem um áudio de exemplo
  gerado programaticamente, mas nenhum vídeo — este ambiente não tem `ffmpeg`
  para gerar um. Suba um `.mp4` curto pela aba Mídia pra validar fundo animado
  e vídeo no roteiro com conteúdo de verdade.

## 3. Funcionalidades adiadas de propósito (decisão já tomada, não iniciar sem pedir)

- [ ] **Módulo de Bíblia** com traduções licenciadas. Adiado porque exige
  parceria com uma sociedade bíblica antes de qualquer código (o caso
  Holyrics × Sociedade Bíblica do Brasil, documentado no Painel de Regência,
  é a prova: eles levaram uma notificação extrajudicial por distribuir
  traduções sem autorização).
- [ ] **Escala de equipe/voluntários** — quem serve em qual culto. Fora de
  escopo desde a primeira definição do prompt de núcleo ao vivo.
- [ ] **Relatórios administrativos** (músicas mais tocadas, frequência, atas).
- [ ] **Automação avançada** (API/JavaScript, MIDI, integrações com
  Telegram/OBS/NDI) — recurso de igreja grande com equipe técnica dedicada;
  fora do público-alvo (igrejas pequenas) por enquanto.
- [ ] **Edição colaborativa** — duas pessoas montando o mesmo culto ao mesmo
  tempo, de computadores diferentes.

## 4. Melhorias menores identificadas mas não implementadas

- [ ] **Indicador "Admin" na contagem de telas conectadas.** Hoje o painel
  mostra quantas telas de Projeção e Stage estão conectadas, mas não mostra
  se há mais de um painel Admin aberto ao mesmo tempo (útil pra saber se duas
  pessoas estão operando sem perceber uma a outra).
- [ ] **Modelos/rascunhos de aviso reaproveitáveis** além do "salvar como
  aviso" simples — ex. variáveis num texto (data do culto, nome do pregador)
  preenchidas automaticamente.
- [ ] **Alternância clara/escuro** no painel Admin — hoje só tem o tema
  escuro; não é bloqueante, mas ficou registrado no prompt como algo a
  considerar.
- [ ] **Auditoria de transições de tela** — confirmar que toda troca de
  conteúdo no painel (não só na projeção) usa fade/transição suave, sem corte
  seco, conforme o padrão definido no item de qualidade visual.

## 5. Validação

- [ ] **Rodar o `docs/roteiro-de-testes.md` na prática** com um operador de
  verdade (você mesmo, simulando um culto) — é o item de maior prioridade
  antes de somar qualquer coisa nova desta lista. Ver também a seção 4 do
  `docs/prompt-nucleo-ao-vivo.md`.

---

*Este arquivo é vivo — risque o que for feito, adicione o que aparecer durante
os testes.*
