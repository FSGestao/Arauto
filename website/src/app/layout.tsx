import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arauto — Acesso ao aplicativo",
  description:
    "Solicite acesso, faça login e baixe o aplicativo de projeção de letras e avisos para sua igreja.",
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
