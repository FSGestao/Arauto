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
      <body>{children}</body>
    </html>
  );
}
