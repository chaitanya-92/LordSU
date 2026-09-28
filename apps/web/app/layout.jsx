import "./globals.css";

export const metadata={
  title:"LordSU — Manager Builder",
  description:"Build a custom Android root manager from an approved backend"
};

export default function RootLayout({children}){
  return <html lang="en"><body>{children}</body></html>;
}
