"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { SETUP_FLAG, markSetupFlag, readSetupFlag } from "../setupProgress";

/* ═══════════════════════════════════════════════════════
   Configuração inicial — um roteiro de 10 passos cobrindo as funções
   principais, pra que a primeira semana de uso não vire descoberta ao vivo,
   no meio do culto. Cada passo se marca sozinho a partir de um sinal real
   (tem música com letra? a Projeção já conectou alguma vez?), nunca de um
   "marcar como lido" — o objetivo é que a pessoa tenha feito de verdade,
   não que tenha clicado num checkbox.

   Formato: gaveta lateral aberta por um botão na barra. Três decisões
   deliberadas pra que o guia nunca atrapalhe o que ele está ensinando:

     1. A gaveta EMPURRA o painel (padding-right no .cockpit) em vez de
        flutuar por cima — nada do sistema fica escondido enquanto ela
        está aberta.
     2. Não existe fundo escurecido nem captura de clique: o painel
        continua inteiro utilizável com a gaveta aberta.
     3. Ao clicar na ação de um passo ela se fecha sozinha, devolvendo a
        largura toda justamente na hora em que a pessoa vai mexer no
        lugar que o passo indicou.
   ═══════════════════════════════════════════════════════ */

export interface SetupStepState {
  churchNamed: boolean;
  colorsCustomized: boolean;
  songWithLyrics: boolean;
  announcementCreated: boolean;
  mediaUploaded: boolean;
  serviceBuilt: boolean;
}

interface Step {
  id: string;
  icon: string;
  label: string;
  hint: string;
  done: boolean;
  actionLabel?: string;
  action?: () => void;
}

export function SetupChecklist({
  state,
  projectionConnected,
  stageConnected,
  remoteConnected,
  onOpenAppearance,
  onNewSong,
  onNewAnnouncement,
  onNewMedia,
  onOpenBible,
  onNewService,
  onOpenProjection,
  onOpenStage,
  onOpenTimer,
  onOpenRemote,
  onOpenManual,
}: {
  state: SetupStepState;
  projectionConnected: boolean;
  stageConnected: boolean;
  remoteConnected: boolean;
  onOpenAppearance: () => void;
  onNewSong: () => void;
  onNewAnnouncement: () => void;
  onNewMedia: () => void;
  onOpenBible: () => void;
  onNewService: () => void;
  onOpenProjection: () => void;
  onOpenStage: () => void;
  onOpenTimer: () => void;
  onOpenRemote: () => void;
  onOpenManual: () => void;
}) {
  // Começa escondido e só aparece depois de ler o localStorage — sem isso, o
  // botão "pisca" na barra de quem já dispensou, a cada carregamento.
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState({ projection: false, stage: false, bible: false, timer: false, remote: false, manual: false });

  useEffect(() => {
    setDismissed(readSetupFlag(SETUP_FLAG.dismissed));
    setFlags({
      projection: readSetupFlag(SETUP_FLAG.projection),
      stage: readSetupFlag(SETUP_FLAG.stage),
      bible: readSetupFlag(SETUP_FLAG.bible),
      timer: readSetupFlag(SETUP_FLAG.timer),
      remote: readSetupFlag(SETUP_FLAG.remote),
      manual: readSetupFlag(SETUP_FLAG.manual),
    });
    setReady(true);
  }, []);

  // Uma tela conectada agora vira marca permanente: o passo não pode voltar
  // a "pendente" só porque a janela da Projeção foi fechada depois do culto.
  useEffect(() => {
    if (projectionConnected && !flags.projection) {
      markSetupFlag(SETUP_FLAG.projection);
      setFlags((f) => ({ ...f, projection: true }));
    }
  }, [projectionConnected, flags.projection]);

  useEffect(() => {
    if (stageConnected && !flags.stage) {
      markSetupFlag(SETUP_FLAG.stage);
      setFlags((f) => ({ ...f, stage: true }));
    }
  }, [stageConnected, flags.stage]);

  // Mesma lógica: um celular pareado de verdade (não só o botão clicado)
  // marca o passo — igual à Projeção/Stage View.
  useEffect(() => {
    if (remoteConnected && !flags.remote) {
      markSetupFlag(SETUP_FLAG.remote);
      setFlags((f) => ({ ...f, remote: true }));
    }
  }, [remoteConnected, flags.remote]);

  // Revê as marcas guardadas quando a janela volta ao foco — a Bíblia, o
  // timer e o Manual são marcados em outros pontos do painel, então o
  // estado aqui pode estar defasado.
  useEffect(() => {
    function sync() {
      setFlags({
        projection: readSetupFlag(SETUP_FLAG.projection),
        stage: readSetupFlag(SETUP_FLAG.stage),
        bible: readSetupFlag(SETUP_FLAG.bible),
        timer: readSetupFlag(SETUP_FLAG.timer),
        remote: readSetupFlag(SETUP_FLAG.remote),
        manual: readSetupFlag(SETUP_FLAG.manual),
      });
    }
    window.addEventListener("focus", sync);
    const interval = setInterval(sync, 4000);
    return () => {
      window.removeEventListener("focus", sync);
      clearInterval(interval);
    };
  }, []);

  // A classe no <body> é o que faz o cockpit abrir espaço pra gaveta. Fica
  // aqui (e não numa prop) pra que o layout não dependa de o painel inteiro
  // re-renderizar a cada abre-e-fecha.
  useEffect(() => {
    document.body.classList.toggle("setup-drawer-open", open);
    return () => document.body.classList.remove("setup-drawer-open");
  }, [open]);

  // Esc fecha — é o reflexo de quem quer a tela inteira de volta depressa.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const steps: Step[] = [
    {
      id: "nome",
      icon: "settings",
      label: "Nomeie sua igreja",
      hint: "Aparece na tela de projeção",
      done: state.churchNamed,
      actionLabel: "Configurar",
      action: onOpenAppearance,
    },
    {
      id: "cores",
      icon: "sliders",
      label: "Escolha as cores da projeção",
      hint: "Fundo, texto e destaque do telão",
      done: state.colorsCustomized,
      actionLabel: "Personalizar",
      action: onOpenAppearance,
    },
    {
      id: "musica",
      icon: "lyrics",
      label: "Cadastre uma música com letra",
      hint: "Importe do YouTube ou cole o texto",
      done: state.songWithLyrics,
      actionLabel: "Nova música",
      action: onNewSong,
    },
    {
      id: "aviso",
      icon: "bell",
      label: "Crie um aviso",
      hint: "Texto ou imagem para o telão",
      done: state.announcementCreated,
      actionLabel: "Novo aviso",
      action: onNewAnnouncement,
    },
    {
      id: "midia",
      icon: "media",
      label: "Envie uma mídia",
      hint: "Vídeo, imagem ou trilha de fundo",
      done: state.mediaUploaded,
      actionLabel: "Enviar",
      action: onNewMedia,
    },
    {
      id: "biblia",
      icon: "book",
      label: "Busque um versículo",
      hint: 'Digite algo como "jo 3:16"',
      done: flags.bible,
      actionLabel: "Abrir Bíblia",
      action: onOpenBible,
    },
    {
      id: "roteiro",
      icon: "layers",
      label: "Monte um roteiro de culto",
      hint: "A ordem do culto, pronta antes da hora",
      done: state.serviceBuilt,
      actionLabel: "Novo culto",
      action: onNewService,
    },
    {
      id: "projecao",
      icon: "projection",
      label: "Abra a tela de Projeção",
      hint: "No computador ligado ao telão",
      done: flags.projection,
      actionLabel: "Abrir",
      action: onOpenProjection,
    },
    {
      id: "palco",
      icon: "stage",
      label: "Abra a Stage View",
      hint: "Monitor de confiança de quem está no palco",
      done: flags.stage,
      actionLabel: "Abrir",
      action: onOpenStage,
    },
    {
      id: "timer",
      icon: "clock",
      label: "Configure um timer",
      hint: "Contagem regressiva antes do culto começar",
      done: flags.timer,
      actionLabel: "Abrir timer",
      action: onOpenTimer,
    },
    {
      id: "remoto",
      icon: "phone",
      label: "Pareie o controle remoto",
      hint: "Controle o culto pelo celular, longe do computador",
      done: flags.remote,
      actionLabel: "Parear celular",
      action: onOpenRemote,
    },
    {
      id: "manual",
      icon: "book",
      label: "Explore o Manual completo",
      hint: "Tutoriais visuais de cada função, passo a passo",
      done: flags.manual,
      actionLabel: "Abrir Manual",
      action: onOpenManual,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pending = steps.length - doneCount;
  const percent = Math.round((doneCount / steps.length) * 100);
  const complete = doneCount === steps.length;
  const nextStep = steps.find((s) => !s.done);

  if (!ready || dismissed) return null;

  function dismiss() {
    markSetupFlag(SETUP_FLAG.dismissed);
    setOpen(false);
    setDismissed(true);
  }

  // Toda ação fecha a gaveta antes de agir: o passo aponta pra algum canto do
  // painel, e esse canto precisa estar livre no instante seguinte ao clique.
  function runStep(action: () => void) {
    setOpen(false);
    action();
  }

  // Perímetros dos dois anéis: o pequeno do botão (r=9, viewBox 24) e o
  // grande da gaveta (r=15.5, viewBox 36).
  const CIRC = 2 * Math.PI * 9;
  const RING = 2 * Math.PI * 15.5;

  return (
    <>
      <button
        className={`setup-trigger ${open ? "active" : ""} ${complete ? "complete" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={complete ? "Configuração inicial concluída" : `Configuração inicial — ${pending} passo(s) restante(s)`}
        aria-expanded={open}
      >
        <svg className="setup-trigger-ring" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle
            cx="12"
            cy="12"
            r="9"
            className="setup-trigger-ring-fill"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - percent / 100)}
          />
        </svg>
        <Icon name={complete ? "checklist" : "compass"} size={18} />
        {!complete && <span className="setup-trigger-badge">{pending}</span>}
      </button>

      <aside className={`setup-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <header className={`setup-drawer-head ${complete ? "complete" : ""}`}>
          <div className="setup-drawer-headline">
            <div className="setup-drawer-title">
              <h2>{complete ? "Tudo pronto" : "Configuração inicial"}</h2>
              <p>
                {complete
                  ? "Nenhum passo pendente"
                  : `${pending === 1 ? "Falta 1 passo" : `Faltam ${pending} passos`} para conhecer tudo`}
              </p>
            </div>
            <button className="setup-drawer-close" onClick={() => setOpen(false)} title="Fechar (Esc)">
              <Icon name="chevronRight" size={14} />
            </button>
          </div>

          {/* Anel grande: o progresso é a primeira coisa que se lê ao abrir. */}
          <div
            className="setup-drawer-gauge"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="setup-ring">
              <svg viewBox="0 0 36 36" aria-hidden="true">
                <circle className="setup-ring-track" cx="18" cy="18" r="15.5" />
                <circle
                  className="setup-ring-fill"
                  cx="18"
                  cy="18"
                  r="15.5"
                  strokeDasharray={RING}
                  strokeDashoffset={RING * (1 - percent / 100)}
                />
              </svg>
              <span className="setup-ring-value">{percent}%</span>
            </span>
            <p>
              {complete
                ? "Você já passou por todos os recursos principais do Arauto."
                : `Você já passou por ${doneCount} dos ${steps.length} recursos principais do Arauto.`}
            </p>
          </div>

          {!complete && nextStep && (
            <p className="setup-drawer-next">
              Próximo: <strong>{nextStep.label}</strong>
            </p>
          )}
        </header>

        <div className="setup-steps">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={`setup-step ${step.done ? "done" : ""} ${step.id === nextStep?.id ? "next" : ""}`}
            >
              <span className="setup-step-mark">{step.done ? "✓" : i + 1}</span>
              <span className="setup-step-icon">
                <Icon name={step.icon} size={15} />
              </span>
              <span className="setup-step-text">
                <strong>{step.label}</strong>
                <em>{step.hint}</em>
              </span>
              {!step.done && step.action && (
                <button className="setup-step-btn" onClick={() => runStep(step.action!)}>
                  {step.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>

        <footer className="setup-drawer-foot">
          {/* A gaveta não cobre nada, mas quem já sabe usar o sistema não
              precisa nem do botão na barra. */}
          <button className="setup-drawer-dismiss" onClick={dismiss}>
            {complete ? "Concluir e ocultar" : "Não mostrar mais"}
          </button>
        </footer>
      </aside>
    </>
  );
}
