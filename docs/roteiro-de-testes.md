# Roteiro de Testes — Arauto

Marque cada cenário depois de testar. Se algo falhar, anote o que aconteceu na
coluna de observações (mensagem de erro, o que você esperava vs. o que
apareceu) — isso vale mais do que só marcar "Não OK".

Servidor: `npm run dev` (ou o app instalado), acesse `http://localhost:3210`.

**Como o painel está organizado (layout cockpit):**

- **Barra do topo** — logo, campo de busca global, os 4 filtros (Letras,
  Avisos, Mídia, Cultos), as bolinhas de conexão e, à direita, os botões
  Roteiro / Stage View / Configurações / **Abrir Projeção**.
- **Centro** — a biblioteca do filtro escolhido. No filtro Letras ela se
  divide em duas colunas: a lista à esquerda e a letra da música selecionada à
  direita.
- **Coluna da direita** — o **Roteiro do Culto**.
- **Barra de baixo (dock)** — prévia ao vivo da projeção, o que está No ar,
  Anterior / Próximo / Auto / Limpar, volume e Timer.

Os botões de cada item (Projetar, Adicionar ao Roteiro, etc.) aparecem ao
passar o mouse sobre ele ou quando ele está selecionado.

**Legenda:** ⚙ = conferido por verificação automática.

Com o servidor rodando (`npm run dev` noutra janela), **`npm run verificar`**
percorre sozinho os 74 cenários marcados com ⚙, em cerca de cinco minutos.
Ele abre painel, projeção e Stage View num navegador sem janela e clica na
interface como você clicaria. São duas partes, que também rodam separadas:

- `npm run verificar:painel` — cadastro, envio de arquivos, montagem de culto,
  configurações, backup, falhas e tela estreita.
- `npm run verificar:ao-vivo` — a apresentação de um culto inteiro e a
  sincronia entre painel, projeção e Stage View.

A verificação cria os próprios dados, todos começando com `[verificação]`, e
apaga tudo no fim. Não encosta no seu acervo.

**Os cinco cenários sem ⚙ continuam sendo teste de gente**, e cada um por um
motivo concreto:

| Cenário | Por que precisa de você |
|---|---|
| 1.1 Criar a primeira conta | Só acontece com o `data/users.json` vazio; forçar isso apagaria sua conta. |
| 1.2 Login / 1.3 Senha errada | A verificação entra com um token assinado; ela não sabe a sua senha. |
| 2.2 Importar do YouTube | Depende da internet e de um vídeo legendado. |
| 16.3 Importar um backup válido | Substitui todos os dados — arriscado demais para um robô fazer sozinho. |

E nada disso substitui ver a projeção **no projetor de verdade**, com a fonte
no tamanho certo e o som na caixa da igreja.

---

## 1. Login e conta

**1.1 — Criar a primeira conta**
Passos: acesse o painel pela primeira vez (sem conta criada ainda).
Esperado: pede pra criar nome/e-mail/senha, e depois de criar já entra logado.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**1.2 — Login com conta existente**
Passos: Configurações (engrenagem na barra do topo) → aba Conta → "Sair da conta"; entre de novo com a mesma senha.
Esperado: entra normalmente e o painel volta com tudo no lugar.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**1.3 — Senha errada**
Passos: tente entrar com a senha errada.
Esperado: mensagem de erro clara, não entra.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**1.4 — Logo na tela de login** ⚙
Passos: observe o topo da tela de login.
Esperado: aparece o "A" do Arauto (o mesmo ícone da aba do navegador), não um emoji.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 2. Músicas (filtro Letras)

**2.1 — Criar música com letra colada** ⚙
Passos: filtro **Letras** → "Nova Música" → preencha título e artista → salve → no item da lista, clique no lápis (Letras) → modo "📝 Colar Texto" → cole um texto de várias linhas.
Esperado: cada linha colada vira uma linha de letra separada.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**2.2 — Importar letra do YouTube**
Passos: crie uma música com uma URL do YouTube que tenha legendas → abra Letras → "🔍 Importar do YouTube".
Esperado: as legendas viram linhas de letra com as marcas de tempo preenchidas.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**2.3 — Música sem letra** ⚙
Passos: crie uma música e não adicione nenhuma letra.
Esperado: na lista, embaixo do título aparece "· sem letra"; ao selecioná-la, a coluna da direita diz que ela ainda não tem letra.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**2.4 — Ver a letra na coluna da direita** ⚙
Passos: clique numa música da lista.
Esperado: a coluna da direita mostra o título, os botões e a letra inteira com a marca de tempo `[h:mm:ss]` de cada linha.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**2.5 — Projetar uma linha específica** ⚙
Passos: com a letra na coluna da direita, clique direto numa linha do meio.
Esperado: aquela linha vai ao ar (e a música entra em exibição, se ainda não estava); a linha fica destacada.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**2.6 — Remover música** ⚙
Passos: no item da lista, clique nos três pontinhos (canto do card) → confirme.
Esperado: some da lista e de qualquer culto que a usava (o item fica marcado como "removida" no roteiro).
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**2.7 — Filtrar a lista** ⚙
Passos: digite parte de um título no campo "Buscar ou filtrar..." acima da lista.
Esperado: a lista filtra na hora; sem resultado, aparece "Nada encontrado com esse filtro".
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 3. Avisos (filtro Avisos)

**3.1 — Aviso só com texto** ⚙
Passos: filtro **Avisos** → "Novo Aviso" → preencha título e conteúdo, sem imagem/vídeo.
Esperado: salva e aparece na lista como "Ativo", com o começo do texto embaixo do título.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**3.2 — Aviso com imagem** ⚙
Passos: novo aviso, anexe uma imagem (jpg/png/gif/webp).
Esperado: salva e o item mostra "· imagem"; ao projetar, a imagem aparece na tela.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**3.3 — Aviso com vídeo** ⚙
Passos: novo aviso, anexe um vídeo (mp4/webm/ogv).
Esperado: o item mostra "· vídeo"; ao projetar, o vídeo toca.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**3.4 — Ativar/desativar aviso** ⚙
Passos: clique em "Desativar" num aviso ativo.
Esperado: o texto de apoio muda pra "Inativo" e ele some da lista de avisos disponíveis para inserção rápida.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**3.5 — Criar um modelo de aviso** ⚙
Passos: filtro Avisos → "Modelo" → escreva um texto com uma variável entre chaves duplas, ex.: `Reunião de oração dia {{data}}`.
Esperado: o modelo aparece numa seção "Modelos de aviso" acima dos avisos.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**3.6 — Usar um modelo** ⚙
Passos: no modelo criado, clique "Usar modelo" → preencha a variável.
Esperado: a pré-visualização mostra o texto já com o valor preenchido; ao confirmar, nasce um aviso novo na lista.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 4. Mídia (filtro Mídia)

**4.1 — Enviar áudio** ⚙
Passos: filtro **Mídia** → "Enviar Áudio/Vídeo" → escolha um mp3/wav/ogg/m4a.
Esperado: aparece na lista com um player de conferência funcionando.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**4.2 — Enviar vídeo** ⚙
Passos: mesma coisa, com um mp4/webm/ogv.
Esperado: aparece com preview de vídeo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**4.3 — Marcar loop** ⚙
Passos: marque a caixa "Loop" nos botões do item.
Esperado: fica salvo — recarregue a página e confira que continua marcado e que o item mostra "· em loop".
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**4.4 — Remover mídia** ⚙
Passos: três pontinhos no card → confirme.
Esperado: some da lista; o arquivo é apagado do disco (pasta `data/media`).
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 5. Cultos e montagem do roteiro

**5.1 — Criar culto** ⚙
Passos: filtro **Cultos** → "Novo Culto" → nome e data.
Esperado: aparece na lista e passa a ser o culto selecionado (fica destacado).
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**5.2 — Montar o roteiro pela biblioteca** ⚙
Passos: com o culto selecionado, vá aos filtros Letras / Avisos / Mídia e clique "Adicionar ao Roteiro" em alguns itens.
Esperado: cada item aparece na hora na coluna Roteiro do Culto, no fim da lista, numerado.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**5.3 — Trocar o culto ativo** ⚙
Passos: no alto da coluna Roteiro, use a lista suspensa com os nomes dos cultos.
Esperado: o roteiro mostrado troca, e "Adicionar ao Roteiro" passa a alimentar o culto novo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**5.4 — Reordenar arrastando (antes de apresentar)** ⚙
Passos: arraste um item do roteiro pra outra posição → recarregue a página.
Esperado: a nova ordem persistiu (foi salva no culto, não só na tela).
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**5.5 — Deixar um item de fora** ⚙
Passos: desmarque a caixa de um item do roteiro.
Esperado: fica apagado/riscado, continua salvo no culto, mas não entra na apresentação.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**5.6 — Tirar um item do roteiro** ⚙
Passos: clique na lixeira do item.
Esperado: sai da lista e a numeração se reajusta.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**5.7 — Editor do culto (setas ↑↓)** ⚙
Passos: no item da lista de cultos, clique "Editar" → use ↑ e ↓ → Salvar.
Esperado: a ordem muda e bate com o que aparece na coluna Roteiro.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**5.8 — Duplicar culto** ⚙
Passos: clique "Duplicar" num culto existente.
Esperado: aparece uma cópia com "(cópia)" no título, com os mesmos itens.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**5.9 — Apresentar** ⚙
Passos: clique "Apresentar" no culto (na lista ou no botão "Apresentar culto" no pé da coluna Roteiro).
Esperado: o primeiro item entra no ar; a cabeça da coluna passa a mostrar "nome do culto · 1/N".
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 6. Apresentação ao vivo

**6.1 — Avançar pela letra dentro da mesma música** ⚙
Passos: com uma música (2+ linhas) no ar, clique "Próximo" na dock várias vezes.
Esperado: avança linha por linha ANTES de trocar pro próximo item do roteiro.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.2 — Voltar** ⚙
Passos: clique "Anterior".
Esperado: volta linha a linha e, no começo da música, volta pro item anterior do roteiro.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.3 — Avanço automático (Auto)** ⚙
Passos: com uma música no ar que tenha marcas de tempo, clique "Auto".
Esperado: a letra passa sozinha no tempo certo; o botão vira "Pausar".
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.4 — Arrastar um card durante a apresentação** ⚙
Passos: na coluna Roteiro, arraste um card pra outra posição.
Esperado: a ordem muda na hora; o item que estava no ar continua no ar (não pula sozinho).
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.5 — Ocultar um item durante a apresentação** ⚙
Passos: desmarque a caixa de um card que ainda não passou.
Esperado: fica riscado; ao chegar nele, o Próximo pula pra frente sem mostrá-lo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.6 — Clicar direto num card** ⚙
Passos: clique em qualquer card do roteiro (não na caixa).
Esperado: pula direto pra ele, mesmo fora de ordem.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.7 — Contador de passo** ⚙
Passos: observe a cabeça da coluna Roteiro enquanto avança.
Esperado: o "x/N" acompanha o passo atual.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.8 — "A seguir" na dock** ⚙
Passos: observe a linha embaixo de "No ar:".
Esperado: mostra a PRÓXIMA linha de letra; fora de uma música, mostra o culto e o passo. Nunca mostra o que já está no ar.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.9 — Limpar** ⚙
Passos: clique "Limpar" na dock.
Esperado: a projeção fica em branco e a dock passa a dizer "No ar: tela em branco".
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 7. Tela de projeção

**7.1 — Abrir a projeção** ⚙
Passos: clique "Abrir Projeção" no canto direito da barra do topo.
Esperado: abre uma janela nova só com a projeção, sem menus.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**7.2 — Prévia da dock** ⚙
Passos: com a projeção fechada, olhe a miniatura no canto esquerdo da dock e avance um passo.
Esperado: a miniatura é a projeção de verdade, em escala, e muda junto.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**7.3 — Setas do teclado** ⚙
Passos: com a projeção aberta e um culto em apresentação, aperte ← e → **na janela da projeção**.
Esperado: avança/volta, igual ao painel.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**7.4 — Clique na tela** ⚙
Passos: clique em qualquer lugar da tela de projeção.
Esperado: avança um passo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**7.5 — Tela cheia (F)** ⚙
Passos: aperte "F" na tela de projeção.
Esperado: entra/sai de tela cheia.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**7.6 — Sem logo do sistema na projeção** ⚙
Passos: observe a tela de projeção em qualquer modo.
Esperado: o "A" do Arauto NÃO aparece — só o logo da igreja, se você tiver configurado um.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 8. Inserir algo no meio do culto

**8.1 — Abrir o painel de inserção** ⚙
Passos: com um culto em apresentação, clique no "+" no alto da coluna Roteiro.
Esperado: abre o campo "Texto rápido" com título, texto e dois botões.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**8.2 — Mostrar um texto avulso** ⚙
Passos: preencha título e texto → "Mostrar agora".
Esperado: vai ao ar; aparece a faixa "Exibindo item avulso — roteiro pausado".
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**8.3 — Voltar ao roteiro** ⚙
Passos: clique "Voltar ao roteiro" na faixa.
Esperado: volta EXATAMENTE pro mesmo passo em que estava antes da interrupção.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**8.4 — Salvar o texto rápido como aviso** ⚙
Passos: digite um texto e clique "Salvar como aviso".
Esperado: aparece no filtro Avisos como um aviso novo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**8.5 — Projetar da biblioteca sem perder o roteiro** ⚙
Passos: com um culto rodando, vá ao filtro Avisos e clique "Projetar" num aviso.
Esperado: mostra o aviso e marca o roteiro como pausado; "Voltar ao roteiro" traz de volta pro passo certo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 9. Áudio e vídeo ao vivo

**9.1 — Play/pause de mídia** ⚙
Passos: coloque um item de mídia no ar → na dock, clique "Pausar" / "Retomar".
Esperado: o áudio/vídeo pausa e retoma de verdade na tela de projeção.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**9.2 — Arrastar a posição (seek)** ⚙
Passos: com mídia no ar, arraste a barra de posição no meio da dock (ela substitui a linha "A seguir").
Esperado: o áudio/vídeo pula pra posição escolhida; os tempos dos dois lados da barra acompanham.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**9.3 — Volume** ⚙
Passos: mexa no slider de volume, no canto direito da dock.
Esperado: o volume muda suavemente na projeção (sem corte seco).
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**9.4 — Vídeo de fundo** ⚙
Passos: no filtro Mídia, num item de vídeo, clique "Usar como fundo" → avance por algumas músicas/avisos.
Esperado: o vídeo continua tocando em loop atrás do conteúdo, trocando de passo em passo. "Tirar do fundo" desfaz.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 10. Edição de letra ao vivo

**10.1 — Corrigir a linha que está no ar** ⚙
Passos: com uma música no ar, vá até a coluna de letras e clique na linha destacada (a que está no ar) → digite a correção → Enter.
Esperado: a tela de projeção atualiza na hora, sem precisar avançar/voltar.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**10.2 — Correção persiste** ⚙
Passos: depois de corrigir, recarregue o painel e abra a mesma música.
Esperado: a correção continua lá — foi salva de verdade, não só na tela.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 11. Contagem regressiva (Timer)

**11.1 — Iniciar sem culto em apresentação** ⚙
Passos: na dock, clique no relógio ao lado de "Timer" → defina minutos e mensagem → Iniciar.
Esperado: aparece na projeção contando pra baixo; o relógio da dock passa a contar junto e fica destacado.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**11.2 — Iniciar com culto em apresentação** ⚙
Passos: com um culto já rodando, inicie uma contagem.
Esperado: vira interjeição (roteiro pausado); ao parar, volta pro passo certo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**11.3 — Ver na Stage View** ⚙
Passos: abra `/stage` durante uma contagem regressiva.
Esperado: mostra o mesmo relógio, em fonte grande.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 12. Busca global

**12.1 — Digitar na barra do topo** ⚙
Passos: clique no campo "Buscar música, aviso ou mídia" e digite.
Esperado: o painel de busca abre já com o texto digitado e resultados filtrados.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**12.2 — Abrir com Ctrl+K** ⚙
Passos: de qualquer lugar do painel, aperte Ctrl+K.
Esperado: abre a busca com o cursor já no campo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**12.3 — Enter coloca no ar** ⚙
Passos: navegue com as setas até um resultado e aperte Enter.
Esperado: o item vai direto ao ar e a busca fecha.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 13. Stage View (monitor de confiança)

**13.1 — Abrir** ⚙
Passos: clique no ícone de microfone na barra do topo.
Esperado: abre uma janela só com a letra atual e a próxima, sem menus.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**13.2 — Sincronizado com a projeção** ⚙
Passos: avance a apresentação e observe as duas telas lado a lado.
Esperado: a linha atual bate nas duas ao mesmo tempo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 14. Rede local (outro dispositivo)

**14.1 — Abrir a projeção de outro computador/celular** ⚙
Passos: Configurações → aba **Telas** → copie o endereço de Projeção e abra num celular na mesma Wi-Fi.
Esperado: abre sem pedir login e mostra o mesmo conteúdo ao vivo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**14.2 — Bolinhas de conexão** ⚙
Passos: com a projeção aberta em outro aparelho, observe as três bolinhas na barra do topo (passe o mouse pra ver a legenda).
Esperado: a bolinha da projeção acende; a da stage acende quando a Stage View estiver aberta.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**14.3 — Aviso de painel duplicado** ⚙
Passos: abra o painel em duas abas ao mesmo tempo.
Esperado: a primeira bolinha fica amarela, avisando que há mais de um operador.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 15. Falhas e recuperação

**15.1 — Mídia quebrada** ⚙
Passos: renomeie um arquivo dentro de `data/media` e apresente o passo que o usava.
Esperado: a projeção mostra o título + "não foi possível carregar este arquivo", e avança sozinha depois de alguns segundos (se estiver num roteiro) — nunca fica em branco sem explicação.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**15.2 — Queda e volta de rede** ⚙
Passos: com a projeção aberta em outro dispositivo, desligue o Wi-Fi dele por 10 segundos e ligue de novo.
Esperado: reconecta sozinha e mostra o estado atual — não fica travada na última tela antiga.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**15.3 — Recarregar o painel no meio do culto** ⚙
Passos: com um culto rodando, aperte F5 no painel.
Esperado: volta exibindo o mesmo passo, sem interromper a projeção.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 16. Backup

**16.1 — Exportar** ⚙
Passos: Configurações → aba **Backup** → "Exportar Backup".
Esperado: baixa um arquivo `.zip`.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**16.2 — Importar um zip inválido** ⚙
Passos: tente importar qualquer `.zip` que não seja um backup do Arauto.
Esperado: mensagem de erro clara, nada é alterado.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**16.3 — Importar um backup válido**
Passos: mude algo (ex.: renomeie uma música), exporte, mude de novo, depois importe o backup exportado.
Esperado: os dados voltam ao estado do momento da exportação.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 17. Configurações

**17.1 — Identidade visual** ⚙
Passos: Configurações → aba **Aparência** → mude nome da igreja, cores e logo → Salvar.
Esperado: o "Preview da Projeção" na própria janela muda; a tela de projeção reflete as cores novas.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**17.2 — Tema do painel** ⚙
Passos: Configurações → Aparência → alterne entre claro e escuro.
Esperado: o painel inteiro troca de tema, sem texto ilegível em nenhum canto; a escolha sobrevive ao recarregar.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**17.3 — As cinco abas abrem** ⚙
Passos: percorra Aparência, Telas, Backup, Conta e Sobre.
Esperado: todas abrem com conteúdo, sem tela vazia.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 18. Tela estreita (notebook pequeno / tablet)

**18.1 — Gaveta do roteiro** ⚙
Passos: estreite a janela até uns 1100px de largura.
Esperado: a coluna Roteiro some e passa a abrir pelo botão de lista da barra do topo, como uma gaveta opaca; clicar fora fecha.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**18.2 — Coluna de letras** ⚙
Passos: estreite até uns 900px.
Esperado: a coluna de letras some e a lista de músicas ocupa a largura toda; os filtros viram só ícones.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**18.3 — Dock em tela pequena** ⚙
Passos: estreite até uns 700px.
Esperado: a dock reorganiza (prévia, texto e botões) sem cortar botão nenhum e sem barra de rolagem horizontal.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## Resumo

Total de cenários: 79 — sendo **74 automáticos** (`npm run verificar`) e
**5 manuais** (1.1, 1.2, 1.3, 2.2 e 16.3).

Automáticos: ☐ passaram todos ☐ falharam: _____________________________

Manuais — OK: _____ Não OK: _____

Cenários que falharam (liste os números): ______________________________

Conferido no projetor de verdade em ____/____/______ por _________________
