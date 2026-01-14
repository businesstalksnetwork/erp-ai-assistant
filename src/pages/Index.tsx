import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BarChart3, Bell, ArrowRight, FileText, QrCode, LineChart } from 'lucide-react';
import logo from '@/assets/pausal-box-logo.png';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <img src={logo} alt="Paušal box" className="h-8" />
          </div>
          <Button asChild>
            <Link to="/auth">Prijavi se</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <span className="inline-block px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-sm font-medium text-primary">
            Za paušalno oporezovane preduzetnike
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Uštedite <span className="text-primary">8+ sati mesečno</span> na administraciji
          </h1>
          <p className="text-xl text-muted-foreground">
            Više od 500 paušalaca u Srbiji koristi Paušal Box za automatsko fakturisanje, vođenje KPO knjige i praćenje limita. Pridružite im se danas.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/auth">
                Besplatno testirajte
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-6 mt-20">
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold">Fakturisanje</h3>
            <p className="text-muted-foreground text-sm">Profesionalne fakture u nekoliko klikova</p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold">KPO Knjiga</h3>
            <p className="text-muted-foreground text-sm">Automatsko vođenje evidencije</p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <LineChart className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold">Praćenje limita</h3>
            <p className="text-muted-foreground text-sm">Real-time praćenje 6M limita</p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold">Poreski podsetnici</h3>
            <p className="text-muted-foreground text-sm">Nikad ne propustite rok</p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <QrCode className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold">QR kod za plaćanje</h3>
            <p className="text-muted-foreground text-sm">IPS QR za brže plaćanje</p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold">Poslovna analitika</h3>
            <p className="text-muted-foreground text-sm">Vizuelni prikaz prihoda</p>
          </div>
        </div>
      </main>
    </div>
  );
}
