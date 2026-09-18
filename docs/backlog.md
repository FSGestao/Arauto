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
  para gerar um. Suba um `.mp4` curto pelo filtro Mídia pra validar fundo animado
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

- [x] **Indicador "Admin" na contagem de telas conectadas.** Feito — o painel
  agora mostra "Admin N" ao lado de Projeção/Stage, com o ponto ficando
  amarelo (e um tooltip de aviso) quando N > 1.
- [x] **Modelos/rascunhos de aviso reaproveitáveis.** Feito — o filtro Avisos
  ganhou seção "Modelos de aviso": cria um rascunho com `{{variavel}}` no
  título/conteúdo (ex. `{{data}}`, `{{pregador}}`), e "Usar" abre um formulário
  só com essas variáveis, mostra pré-visualização e cria o aviso já pronto.
- [x] **Alternância clara/escuro** no painel Admin. Feito — botão em Configurações →
  Aparência, preferência salva no navegador e aplicada já na abertura. A escala de
  cores virou tokens (`--overlay-1..10`) pra funcionar nos dois temas; a tela
  de projeção continua sempre escura de propósito (é o que vai pro telão,
  independe do tema de quem opera). Conferido nos dois temas pela verificação
  automática (cenário 17.2), inclusive que a escolha sobrevive ao recarregar.
- [ ] **Auditoria de transições de tela** — feita a auditoria: os cards/botões
  do painel já têm transição suave (`--transition` aplicado amplamente), mas
  a **troca de conteúdo na tela de projeção** (música → aviso → mídia) ainda
  é um corte seco, sem crossfade — ver `src/app/projection/page.tsx`. Corrigir
  isso é a parte que falta deste item; não implementado ainda porque mexe na
  tela que vai ao vivo pro telão.

## 5. Validação

- [ ] **Rodar o `docs/roteiro-de-testes.md` na prática** com um operador de
  verdade (você mesmo, simulando um culto) — é o item de maior prioridade
  antes de somar qualquer coisa nova desta lista. Ver também a seção 4 do
  `docs/prompt-nucleo-ao-vivo.md`.

---

*Este arquivo é vivo — risque o que for feito, adicione o que aparecer durante
os testes.*
