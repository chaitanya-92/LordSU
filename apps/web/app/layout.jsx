export const metadata = {
  title: "LordSU — Manager Builder",
  description: "Build a custom Android root manager"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
