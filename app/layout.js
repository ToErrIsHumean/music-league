import "./globals.css";

export const metadata = {
  title: "Music League Archive",
  description: "Browse imported Music League games and their rounds.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
