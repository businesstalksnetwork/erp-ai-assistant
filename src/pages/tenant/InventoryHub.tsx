import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package, Boxes, ArrowRightLeft, Truck, Layers, ClipboardList,
  ArrowLeftRight, PackageOpen, Calculator, BarChart3, LayoutDashboard, Tag,
} from "lucide-react";

const sections = [
  {
    title: "Zalihe",
    links: [
      { to: "/inventory/products", icon: Package, label: "Proizvodi", desc: "Katalog proizvoda i artikala" },
      { to: "/inventory/stock", icon: Boxes, label: "Stanje zaliha", desc: "Trenutno stanje po magacinima" },
      { to: "/inventory/movements", icon: ArrowRightLeft, label: "Kretanje zaliha", desc: "Ulazi, izlazi i prenosi robe" },
      { to: "/inventory/dispatch-notes", icon: Truck, label: "Otpremnice", desc: "Elektronske otpremnice (eOtpremnica)" },
    ],
  },
  {
    title: "Troškovi i kalkulacije",
    links: [
      { to: "/inventory/cost-layers", icon: Layers, label: "Troškovni slojevi", desc: "FIFO/prosečna cena po artiklima" },
      { to: "/inventory/kalkulacija", icon: Calculator, label: "Kalkulacija", desc: "Kalkulacija nabavne i prodajne cene" },
      { to: "/inventory/nivelacija", icon: BarChart3, label: "Nivelacija", desc: "Korekcija cena i nivelacioni listovi" },
    ],
  },
  {
    title: "Interni tokovi",
    links: [
      { to: "/inventory/internal-orders", icon: ClipboardList, label: "Interne narudžbine", desc: "Zahtevi za internu nabavku" },
      { to: "/inventory/internal-transfers", icon: ArrowLeftRight, label: "Interni transferi", desc: "Prenos robe između magacina" },
      { to: "/inventory/internal-receipts", icon: PackageOpen, label: "Interne prijemnice", desc: "Prijem robe iz internih izvora" },
    ],
  },
  {
    title: "Cene",
    links: [
      { to: "/inventory/retail-prices", icon: Tag, label: "Maloprodajne cene", desc: "Upravljanje cenovnicima za maloprodaju" },
    ],
  },
  {
    title: "WMS",
    links: [
      { to: "/inventory/wms/dashboard", icon: LayoutDashboard, label: "WMS kontrolna tabla", desc: "Pregled zona, lokacija i zadataka u skladištu" },
    ],
  },
];

export default function InventoryHub() {
  return (
    <BiPageLayout
      title="Magacin"
      description="Centralno upravljanje zalihama, kretanjem robe, kalkulacijama i skladišnim operacijama."
      icon={Package}
    >
      {sections.map((section) => (
        <div key={section.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{section.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {section.links.map((link) => (
              <Link key={link.to} to={link.to}>
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardContent className="flex flex-col items-center justify-center p-6 gap-3 text-center">
                    <link.icon className="h-8 w-8 text-primary" />
                    <span className="text-sm font-medium">{link.label}</span>
                    <span className="text-xs text-muted-foreground">{link.desc}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </BiPageLayout>
  );
}
