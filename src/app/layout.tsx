import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Estancia de Oro — Sistema de Pedidos",
  description: "Sistema de gestión de pedidos para Estancia de Oro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
