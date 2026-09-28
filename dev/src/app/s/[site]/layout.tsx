import { Archivo } from "next/font/google";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], display: "swap", axes: ["wdth"] });

export default function GymSiteLayout({ children }: LayoutProps<"/s/[site]">) {
  return <div className={`${archivo.variable} gs`}>{children}</div>;
}
