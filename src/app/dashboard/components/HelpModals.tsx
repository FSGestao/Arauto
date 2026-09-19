"use client";

import { Icon } from "./Icon";

/* ═══════════════════════════════════════════════════════
   "Como usar" (onboarding) e Notas de versão — dois popups simples e
   independentes do resto do painel: não dependem de dado nenhum da igreja,
   só de conteúdo fixo (texto escrito por nós) ou vindo de release-notes/.
   ═══════════════════════════════════════════════════════ */

interface OnboardingSection {
  icon: string;
  title: string;
  text: string;
}

const ONBOARDING: OnboardingSection[] = [
  {
    icon: "search",
    title: "Achar o que você precisa",
    text:
      "Use a busca do topo (Ctrl+K) ou as abas Letras, Avisos, Mídia e Bíblia. Cada aba tem seu próprio campo de busca — na Bíblia, digite direto a referência, como \"jo 3:16\".",
  },
  {
    icon: "play",
    title: "Projetar algo na hora",
    text:
      "Todo item da biblioteca tem um botão \"Projetar\" — coloca no ar imediatamente. O que está sendo exibido agora sempre aparece no rodapé do painel (\"No ar: ...\").",
  },
  {
    icon: "layers",
    title: "Montar o roteiro de um culto",
    text:
      "Na aba Cultos, crie um culto e adicione músicas, avisos, mídia e versículos na ordem que serão usados. Arraste os itens pra reordenar.",
  },
  {
    icon: "stage",
    title: "Durante o culto",
    text:
      "Clique \"Apresentar\" para começar. Use os botões Anterior/Próximo (ou as setas do teclado) para avançar. Quem está no palco pode acompanhar pela Stage View — abra-a antes de começar.",
  },
  {
    icon: "bell",
    title: "Precisou de algo fora do roteiro?",
    text:
      "Com um culto no ar, o botão \"+\" ao lado do roteiro deixa mostrar um versículo ou aviso avulso sem sair da apresentação — ela retoma de onde parou depois.",
  },
  {
    icon: "settings",
    title: "Configurações e backup",
    text:
      "No ícone de engrenagem: cores e nome da igreja, os endereços de rede pra abrir a Projeção e a Stage View em outros computadores, e exportar/importar um backup de tudo.",
  },
];

export function OnboardingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <h2>Bem-vindo ao Arauto</h2>
        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: 20 }}>
          Um resumo rápido de como operar o sistema — leva menos de um minuto.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: "55vh", overflowY: "auto", paddingRight: 4 }}>
          {ONBOARDING.map((s) => (
            <div key={s.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: "var(--radius-md)",
                  background: "var(--overlay-4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary-light)",
                }}
              >
                <Icon name={s.icon} size={17} />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: "0.92rem", marginBottom: 3 }}>{s.title}</p>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{s.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn btn-primary" onClick={onClose}>
            Entendi, vamos começar
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ReleaseNoteEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
}

export function ReleaseNotesModal({
  notes,
  onClose,
}: {
  notes: ReleaseNoteEntry[];
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <h2>Novidades do Arauto</h2>

        {notes.length === 0 ? (
          <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginTop: 12 }}>
            Nenhuma nota de versão disponível ainda.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxHeight: "55vh", overflowY: "auto", marginTop: 16, paddingRight: 4 }}>
            {notes.map((n, i) => (
              <div key={n.version}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                  <span
                    className="btn btn-sm"
                    style={{
                      background: i === 0 ? "var(--primary)" : "var(--overlay-4)",
                      color: i === 0 ? "#fff" : "var(--text-muted)",
                      cursor: "default",
                      fontSize: "0.72rem",
                      padding: "2px 8px",
                    }}
                  >
                    v{n.version}
                  </span>
                  <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>{n.title}</p>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 8 }}>
                  {new Date(n.date).toLocaleDateString("pt-BR")}
                </p>
                <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 5 }}>
                  {n.items.map((item, idx) => (
                    <li key={idx} style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
