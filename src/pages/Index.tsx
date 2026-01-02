import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BarChart3, Bell, ArrowRight, FileText } from 'lucide-react';
import logo from '@/assets/pausal-box-logo.png';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
            <img src={logo} alt="Paušal box" className="h-8" />
          </div>
          <Button asChild>
            <Link to="/auth">Prijavi se</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Aplikacija za preduzetnike paušalce
          </h1>
          <p className="text-xl text-muted-foreground">
            Jednostavno kreiranje faktura, praćenje limita i vođenje KPO knjige.
          </p>
          <Button size="lg" asChild>
            <Link to="/auth">
              Započni besplatno
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Fakture i predračuni</h3>
            <p className="text-muted-foreground text-sm">Kreirajte profesionalne fakture</p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Praćenje limita</h3>
            <p className="text-muted-foreground text-sm">Pratite 6M i 8M limite</p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Podsetnici</h3>
            <p className="text-muted-foreground text-sm">Nikad ne propustite rok</p>
          </div>
        </div>
      </main>
    </div>
  );
}
