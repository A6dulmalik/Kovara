import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Kovara",
  description: "Decentralised social on Stellar",
};
      // onPress={() => router.push("/connect" as Parameters<typeof router.push>[0])}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <NavBar />
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
