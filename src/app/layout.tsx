import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arauto — Avisos e Letras de Músicas",
  description:
    "Aplicativo local para igrejas projetarem avisos e letras de músicas sincronizadas no telão.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Aplica o tema escolhido ANTES da primeira pintura. Sem isto o
            painel volta sempre escuro ao recarregar (a preferência só era
            lida quando a janela de Configurações abria) e, mesmo depois de
            corrigido, haveria um piscar branco/escuro a cada carga. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("arauto-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
