import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, ClipboardList, PackageOpen, FileText } from "lucide-react";

const links = [
  { to: "/purchasing/orders", icon: ClipboardList, label: "Narudžbenice", desc: "Kreiranje i praćenje narudžbenica dobavljačima" },
  { to: "/purchasing/goods-receipts", icon: PackageOpen, label: "Prijemnice", desc: "Prijem robe i kontrola isporuka" },
  { to: "/purchasing/supplier-invoices", icon: FileText, label: "Ulazne fakture", desc: "Evidencija i knjiženje ulaznih faktura" },
];

export default function PurchasingHub() {
  return (
    <BiPageLayout
      title="Nabavka"
      description="Upravljanje nabavnim procesom — od narudžbenica i prijema robe do evidentiranja ulaznih faktura."
      icon={ShoppingCart}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
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
    </BiPageLayout>
  );
}
