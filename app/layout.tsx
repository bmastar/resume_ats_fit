import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RESUME-ATS-FIT \u2014 Optimise ton CV pour les ATS",
  description: "Colle ton CV et une annonce d emploi, obtiens une version optimisee ATS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <nav className="topnav">
          <div className="topnav-inner">
            <Link href="/" className="topnav-brand">RESUME-ATS-FIT</Link>
            <div className="topnav-links">
              <Link href="/" className="topnav-link">Accueil</Link>
              <Link href="/settings" className="topnav-link">Parametres</Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
