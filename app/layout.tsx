import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pracovní kalendář",
  description: "Sdílený pracovní kalendář s přihlášením přes jméno a heslo a podporou PWA."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
