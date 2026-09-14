# Roteiro de Testes — Arauto

Marque cada cenário depois de testar. Se algo falhar, anote o que aconteceu na
coluna de observações (mensagem de erro, o que você esperava vs. o que
apareceu) — isso vale mais do que só marcar "Não OK".

Servidor: `npm run dev` (ou o app instalado), acesse `http://localhost:3210`.

---

## 1. Configuração inicial e login

**1.1 — Criar a primeira conta**
Passos: acesse o painel pela primeira vez (sem conta criada ainda).
Esperado: pede pra criar nome/e-mail/senha, e depois de criar já entra logado.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**1.2 — Login com conta existente**
Passos: saia (Sair na barra lateral) e entre de novo com a mesma senha.
Esperado: entra normalmente.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**1.3 — Senha errada**
Passos: tente entrar com a senha errada.
Esperado: mensagem de erro clara, não entra.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 2. Músicas

**2.1 — Criar música com letra digitada**
Passos: aba Músicas → Nova Música → preencha título e artista → abra Letras → cole um texto (modo "Colar Texto").
Esperado: cada linha colada vira uma linha de letra separada.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**2.2 — Importar letra do YouTube**
Passos: crie uma música com uma URL do YouTube que tenha legendas → em Letras, clique "Importar do YouTube".
Esperado: as legendas viram linhas de letra automaticamente.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**2.3 — Música sem letra**
Passos: crie uma música e não adicione nenhuma letra.
Esperado: aparece um aviso "⚠ sem letra cadastrada" na lista de músicas (aba Projeção, modo sem roteiro).
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**2.4 — Remover música**
Passos: apague uma música da aba Músicas.
Esperado: some da lista e de qualquer culto que a usava (o item fica marcado como "removida" no roteiro).
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 3. Avisos

**3.1 — Aviso só com texto**
Passos: aba Avisos → Novo Aviso → preencha título e conteúdo, sem imagem/vídeo.
Esperado: salva e aparece na lista como "Ativo".
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**3.2 — Aviso com imagem**
Passos: novo aviso, anexe uma imagem (jpg/png/gif/webp).
Esperado: a miniatura aparece no card do aviso.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**3.3 — Aviso com vídeo**
Passos: novo aviso, anexe um vídeo (mp4/webm/ogv).
Esperado: o card mostra "🎬 Vídeo anexado".
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**3.4 — Ativar/desativar aviso**
Passos: clique em "Desativar" num aviso ativo.
Esperado: o badge muda pra "Inativo" e ele some da lista de avisos rápidos na aba Projeção.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 4. Mídia (áudio e vídeo)

**4.1 — Enviar áudio**
Passos: aba Mídia → Enviar Áudio/Vídeo → escolha um mp3/wav/ogg/m4a.
Esperado: aparece na lista com player de conferência funcionando.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**4.2 — Enviar vídeo**
Passos: mesma coisa, com um mp4/webm/ogv.
Esperado: aparece com preview de vídeo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**4.3 — Marcar loop**
Passos: marque "Repetir em loop" num item de mídia.
Esperado: fica salvo (recarregue a página e confira que continua marcado).
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**4.4 — Remover mídia**
Passos: remova um item de mídia.
Esperado: some da lista; o arquivo é apagado do disco (pasta `data/media`).
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 5. Cultos (roteiro)

**5.1 — Criar culto e montar roteiro**
Passos: aba Cultos → Novo Culto → Editar → adicione 2 músicas, 1 aviso e 1 mídia, nessa ordem.
Esperado: a lista mostra os 4 itens na ordem certa, com ícones diferentes por tipo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**5.2 — Reordenar no editor (setas ↑↓)**
Passos: mova um item pra cima/baixo no editor do culto.
Esperado: a ordem muda e persiste ao salvar.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**5.3 — Duplicar culto**
Passos: clique "🗐 Duplicar" num culto existente.
Esperado: aparece uma cópia com "(cópia)" no título, com os mesmos itens.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**5.4 — Apresentar**
Passos: clique "▶ Apresentar" num culto.
Esperado: navega sozinho pra aba Projeção e mostra o primeiro item no ar.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 6. Modo apresentação — roteiro ao vivo (kanban)

**6.1 — Avançar pela letra dentro da mesma música**
Passos: com uma música (2+ linhas) no ar, clique "Próximo" várias vezes.
Esperado: avança linha por linha ANTES de trocar pro próximo item do roteiro.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.2 — Arrastar um card pra reordenar**
Passos: no painel do roteiro (lado direito), arraste um card pra outra posição.
Esperado: a ordem muda na hora; o item que estava tocando continua tocando (não pula sozinho).
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.3 — Ocultar um item**
Passos: desmarque o checkbox de um card que ainda não passou.
Esperado: fica riscado/apagado; ao chegar nele, o Próximo pula pra frente sem mostrá-lo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.4 — Clicar direto num card**
Passos: clique em qualquer card do roteiro (não no checkbox).
Esperado: pula direto pra ele, mesmo fora de ordem.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.5 — Barra de progresso**
Passos: observe a barra no topo do painel de roteiro enquanto avança.
Esperado: enche conforme o culto progride.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**6.6 — "A seguir"**
Passos: observe o painel "A seguir" abaixo de "No ar agora".
Esperado: sempre mostra o PRÓXIMO item visível (pulando os ocultos), nunca o atual.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 7. Navegação na tela de projeção

**7.1 — Setas do teclado**
Passos: com a projeção aberta e um culto em apresentação, aperte ← e → nela.
Esperado: avança/volta, igual ao painel.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**7.2 — Clique na tela**
Passos: clique em qualquer lugar da tela de projeção.
Esperado: avança um passo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**7.3 — Tela cheia (F)**
Passos: aperte "F" na tela de projeção.
Esperado: entra/sai de tela cheia.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 8. Inserir avulso / interjeição

**8.1 — Mostrar aviso avulso sem perder o roteiro**
Passos: com um culto em apresentação, clique "➕ Inserir agora" → escolha um aviso da biblioteca.
Esperado: mostra o aviso; aparece a faixa amarela "roteiro pausado no passo X".
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**8.2 — Voltar ao roteiro**
Passos: clique "↩ Voltar ao roteiro".
Esperado: volta EXATAMENTE pro mesmo passo em que estava antes da interrupção.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**8.3 — Texto rápido com prévia**
Passos: digite um título/texto no campo de texto rápido.
Esperado: aparece uma prévia com a cor de fundo/texto reais da projeção, antes de clicar em "Mostrar agora".
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**8.4 — Salvar texto rápido como aviso**
Passos: digite um texto e clique "💾 Salvar como aviso".
Esperado: aparece na aba Avisos como um aviso novo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 9. Áudio e vídeo ao vivo

**9.1 — Play/pause de mídia**
Passos: coloque um item de mídia no ar → clique "⏸ Pausar" / "▶ Retomar".
Esperado: o áudio/vídeo pausa e retoma de verdade na tela de projeção.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**9.2 — Arrastar a posição (seek)**
Passos: arraste a barra de progresso da mídia no painel.
Esperado: o áudio/vídeo pula pra posição escolhida.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**9.3 — Volume**
Passos: mexa no slider de Volume na zona "Saída".
Esperado: o volume muda suavemente na projeção (sem corte seco).
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**9.4 — Vídeo de fundo**
Passos: escolha um vídeo no seletor "Vídeo de fundo" e avance por algumas músicas/avisos.
Esperado: o vídeo continua tocando em loop atrás do conteúdo, trocando de passo em passo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 10. Edição de letra ao vivo

**10.1 — Corrigir uma linha no ar**
Passos: com uma música no ar, clique na "Linha atual" → digite a correção → Enter.
Esperado: a tela de projeção atualiza na hora, sem precisar avançar/voltar.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**10.2 — Correção persiste**
Passos: depois de corrigir, saia da música e volte a ela mais tarde no mesmo culto (ou abra a música na aba Músicas).
Esperado: a correção continua lá — foi salva de verdade, não só na tela.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 11. Contagem regressiva

**11.1 — Iniciar sem culto em apresentação**
Passos: aba Projeção → painel "⏱ Contagem regressiva" → defina minutos e mensagem → Iniciar.
Esperado: aparece na projeção pública, contando pra baixo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**11.2 — Iniciar com culto em apresentação**
Passos: com um culto já rodando, inicie uma contagem.
Esperado: vira interjeição (roteiro pausado); ao parar, volta pro passo certo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**11.3 — Ver na Stage View**
Passos: abra `/stage` durante uma contagem regressiva.
Esperado: mostra o mesmo relógio, fonte grande.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 12. Busca global

**12.1 — Abrir com Ctrl+K**
Passos: de qualquer aba do painel, aperte Ctrl+K.
Esperado: abre a busca, cursor já no campo de texto.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**12.2 — Resultado ao digitar**
Passos: digite parte do nome de uma música/aviso/mídia.
Esperado: a lista filtra a cada tecla, sem precisar apertar Enter pra buscar.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**12.3 — Enter coloca no ar**
Passos: navegue com as setas até um resultado e aperte Enter.
Esperado: vai direto pra aba Projeção com aquele item no ar.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 13. Stage View

**13.1 — Abrir**
Passos: clique "🎤 Abrir Stage View" na aba Projeção.
Esperado: abre uma nova janela/aba só com a letra atual/próxima, sem menus.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**13.2 — Sincronizado com a projeção**
Passos: avance a apresentação e observe as duas telas (projeção e stage) lado a lado.
Esperado: a linha atual bate nas duas ao mesmo tempo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 14. Rede local (outro dispositivo)

**14.1 — Abrir a projeção de outro computador/celular**
Passos: copie a URL mostrada na aba Projeção ("Para exibir em outro computador...") e abra num celular na mesma Wi-Fi.
Esperado: abre sem pedir login e mostra o mesmo conteúdo ao vivo.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**14.2 — Indicador de telas conectadas**
Passos: com a projeção aberta em outro aparelho, observe o topo da aba Projeção no painel.
Esperado: "Projeção" mostra 1 (ou mais), com a bolinha verde.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 15. Falhas e recuperação

**15.1 — Mídia quebrada**
Passos: no roteiro, aponte um item de mídia pra um arquivo que não existe mais (ou renomeie o arquivo na pasta `data/media`) e apresente esse passo.
Esperado: a projeção mostra o título + "não foi possível carregar este arquivo", e avança sozinha depois de alguns segundos (se estiver num roteiro) — nunca fica em branco sem explicação.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**15.2 — Queda e volta de rede**
Passos: com a projeção aberta em outro dispositivo, desligue o Wi-Fi dele por 10 segundos e ligue de novo.
Esperado: reconecta sozinha e mostra o estado atual — não fica travada na última tela antiga.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 16. Backup

**16.1 — Exportar**
Passos: Configurações → "⬇ Exportar Backup".
Esperado: baixa um arquivo `.zip`.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**16.2 — Importar um zip inválido**
Passos: tente importar qualquer `.zip` que não seja um backup do Arauto.
Esperado: mensagem de erro clara, nada é alterado.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

**16.3 — Importar um backup válido**
Passos: mude algo (ex.: renomeie uma música), exporte, mude de novo, depois importe o backup exportado.
Esperado: os dados voltam ao estado do momento da exportação.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## 17. Configurações

**17.1 — Trocar identidade visual**
Passos: mude nome da igreja, cores e logo → Salvar.
Esperado: o preview na própria página muda; a tela de projeção reflete as cores novas.
Resultado: ☐ OK ☐ Não OK — Observações: ____________________

---

## Resumo

Total de cenários: 45
OK: _____ Não OK: _____

Cenários que falharam (liste os números): ______________________________
