import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Settings, Tag } from "lucide-react";

const links = [
  { to: "/web/settings", icon: Settings, label: "Web podešavanja", desc: "Konfiguracija web prodavnice i integracija" },
  { to: "/web/prices", icon: Tag, label: "Web cene", desc: "Upravljanje cenama za web prodaju" },
];

export default function WebHub() {
  return (
    <BiPageLayout
      title="Web prodaja"
      description="Podešavanje i upravljanje web prodajnim kanalom — konfiguracija prodavnice i cenovnika."
      icon={Globe}
    >
      <div className="grid gap-4 md:grid-cols-2">
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
