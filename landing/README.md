# Landing page do Arauto

Site de divulgação — HTML/CSS puro, sem build, pensado pra ser publicado direto
no Vercel gratuitamente.

## Formulário de contato

O botão "Enviar mensagem" usa o [Formspree](https://formspree.io) (plano
gratuito) pra levar a mensagem direto pro e-mail cadastrado lá — já
configurado (`https://formspree.io/f/mljdgddb`) em dois lugares:

- `landing/index.html` (tag `<form action="...">`)
- `src/app/dashboard/components/SettingsModal.tsx` (constante
  `FORMSPREE_ENDPOINT`) — é o que alimenta o "Fale conosco" de dentro do
  próprio painel do Arauto.

Se um dia precisar trocar de formulário/conta no Formspree, é só atualizar
o endpoint nesses dois arquivos.

## Publicar no Vercel

Opção mais simples (sem instalar nada):

1. Acesse https://vercel.com e crie uma conta (dá pra usar login do GitHub).
2. "Add New" → "Project" → importe o repositório `FSGestao/Arauto`.
3. Em "Root Directory", clique em "Edit" e selecione a pasta `landing`.
4. Framework Preset: "Other" (ou deixe em branco) — não tem build, é HTML puro.
5. Clique em "Deploy".

Em poucos segundos o site fica no ar num endereço tipo
`arauto-xxxx.vercel.app`. Dá pra apontar um domínio próprio depois em
Project → Settings → Domains, sem precisar refazer nada.

Qualquer alteração enviada pra pasta `landing/` no GitHub (`main`) publica
uma nova versão automaticamente — não precisa repetir esses passos depois da
primeira vez.

## Estrutura

- `index.html` — todo o conteúdo da página (hero, recursos, "por que é
  grátis", contato).
- `styles.css` — visual, usando a mesma paleta de cores do painel do Arauto.
- `arauto-logo.png` — logo usado na navegação e no rodapé.

## Trocar textos/imagens depois

Tudo está em `index.html`, sem nenhuma lógica — é só editar o texto direto.
Os botões "Baixar" apontam para
`https://github.com/FSGestao/Arauto/releases/latest/download/Arauto-Setup.exe`
— o GitHub resolve isso automaticamente pro instalador `.exe` da versão mais
nova publicada (o nome do arquivo é sempre o mesmo, `Arauto-Setup.exe`,
graças ao `artifactName` fixo configurado no `package.json` do projeto
principal). Não precisa atualizar o link a cada release; o download já
começa direto, sem passar pela página do GitHub.
