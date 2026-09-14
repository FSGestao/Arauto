# Arauto

Sistema de projeção de letras de músicas e avisos para igrejas/eventos, dividido em duas partes:

1. **App desktop (esta pasta)** — Next.js + Electron + Socket.IO, dados em JSON local. É o produto principal: painel Admin + tela de Projeção, roda offline no computador da igreja.
2. **[`website/`](website/)** — site web (Next.js) separado, cujo único papel é o *gate* de acesso: solicitação → aprovação pelo super‑admin → login → download do instalador do app desktop.

## Por que essa divisão?

- O **app desktop** guarda músicas, letras e avisos em arquivos JSON simples (`data/*.json`), roda um servidor local (Express + Next.js + Socket.IO) e não depende de internet no dia a dia.
- O **site** só existe para controlar *quem pode baixar* o instalador — ele não guarda músicas nem avisos.

---

## App desktop — desenvolvimento

```bash
npm install
npm run dev          # sobe o servidor local em http://localhost:3210 (com WebSocket)
```

Abra `http://localhost:3210` no navegador: na primeira execução ele pede para criar a conta local de administração (não depende do site). Depois disso, vire para o modo Electron:

```bash
npm run electron     # abre a janela do painel (Admin) usando o mesmo servidor local
```

No menu **Projeção → Abrir Janela de Projeção**, uma segunda janela abre — automaticamente na tela estendida, se houver uma. Para exibir em **outro computador da mesma rede**, abra no navegador a URL listada na aba "Projeção" do painel (algo como `http://192.168.x.x:3210/projection`) — não precisa instalar nada nessa segunda máquina.

### Gerar o instalador Windows (.exe)

```bash
npm run electron:pack
```

Gera o instalador em `release/`. Depois, copie o `.exe` gerado para `website/private/downloads/Arauto-Setup.exe` — é esse arquivo que o site libera para download.

### Dados e configuração

- Em desenvolvimento, os dados ficam em `./data/*.json` (users, songs, announcements, settings, media, secret.key).
- No app empacotado (Electron), ficam na pasta de dados do usuário do Windows (`%APPDATA%/Arauto/data`).
- `JWT_SECRET` é opcional — se não definido, é gerado automaticamente na primeira execução.

### Rodando em outra máquina (sem o `.env`)

O arquivo `.env` **não é versionado** de propósito: um segredo que entra no Git
fica no histórico para sempre, e todo mundo com acesso ao repositório passa a
ter a mesma chave. Mas isso não atrapalha, porque **o app desktop não precisa
de `.env` nenhum**:

```bash
git clone https://github.com/FSGestao/Arauto.git
cd Arauto
npm install
npm run dev          # já sobe em http://localhost:3210
```

O que aconteceria sem as variáveis:

| Variável | Sem ela | Quando definir |
|---|---|---|
| `JWT_SECRET` | Gerado sozinho (48 bytes aleatórios) e salvo em `data/secret.key`. Sobrevive a reinícios, então os logins continuam válidos. | Só se quiser o **mesmo** segredo em várias instalações — o que normalmente não se quer. |
| `PORT` | Usa `3210`. | Se a 3210 já estiver ocupada nessa máquina. |

Ou seja: cada instalação gera o próprio segredo local, o que é mais seguro do
que compartilhar um. Se ainda assim precisar fixar valores, copie o modelo
versionado:

```bash
cp .env.example .env     # e preencha o que quiser sobrescrever
```

**O site (`website/`) é o caso diferente:** ele tem segredos de verdade que
não dão para gerar sozinho — `SUPERADMIN_PASSWORD` e as credenciais de SMTP.
Esses valores vão em `.env.local` na máquina de desenvolvimento, e nas
*environment variables* do serviço de hospedagem em produção (ex.: painel da
Vercel) — nunca no repositório. Guarde-os num gerenciador de senhas, não num
arquivo solto.

---

## Site de acesso (`website/`) — desenvolvimento

```bash
cd website
npm install
cp .env.example .env.local   # defina SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD
npm run dev                  # http://localhost:3000
```

Fluxo: alguém preenche "Solicitar Acesso" → o super‑admin loga em `/admin` e aprova/rejeita → o solicitante recebe e‑mail com senha temporária (ou ela aparece na tela, se o SMTP não estiver configurado) → ele loga e cai em `/download`, onde baixa o instalador — só libera o arquivo depois de autenticado.

Publicar em produção: deploy normal de Next.js (ex.: Vercel) + colocar `Arauto-Setup.exe` em `private/downloads/` no ambiente publicado (fora de `public/`, para não ficar acessível sem login).

---

## Nota sobre o `prisma/` remanescente

O projeto começou com Prisma/SQLite e foi migrado para armazenamento em JSON simples. A pasta `prisma/dev.db` não foi possível remover automaticamente porque o arquivo estava bloqueado por outro processo (provável antivírus/indexador) — o schema e o seed já foram removidos e nada no código mais referencia Prisma. Pode apagar a pasta `prisma/` manualmente quando o arquivo não estiver mais em uso.
