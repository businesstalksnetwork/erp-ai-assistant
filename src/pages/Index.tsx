import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, Bell, ArrowRight, FileText, QrCode, LineChart, 
  Clock, Users, FileCheck, Target, Check, X, TrendingUp, BookOpen
} from 'lucide-react';
import { motion } from 'framer-motion';
import logo from '@/assets/pausal-box-logo-light.png';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" }
};

const fadeInRight = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.8, ease: "easeOut" }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.15
    }
  }
};

const floatAnimation = {
  y: [0, -10, 0],
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: "easeInOut" as const
  }
};

const stats = [
  { value: "8+", label: "sati uštede mesečno", sublabel: "Prosečna ušteda vremena" },
  { value: "500+", label: "zadovoljnih korisnika", sublabel: "Paušalaca koji koriste aplikaciju" },
  { value: "15,000+", label: "generisanih faktura", sublabel: "Faktura kreirano godišnje" },
  { value: "99.9%", label: "tačnost kalkulacija", sublabel: "Preciznost u svim obračunima" },
];

const features = [
  { icon: FileText, title: "Fakturisanje", desc: "Kreirajte profesionalne fakture u nekoliko klikova." },
  { icon: BarChart3, title: "KPO Knjiga", desc: "Automatsko vođenje Knjige o ostvarenom prometu." },
  { icon: LineChart, title: "Praćenje limita", desc: "Real-time praćenje prihoda i upozorenja za limite." },
  { icon: Bell, title: "Poreski podsetnici", desc: "Automatski podsetnici za sve poreske obaveze." },
  { icon: QrCode, title: "QR kod za plaćanje", desc: "IPS QR kod na fakturama za brže plaćanje." },
  { icon: BarChart3, title: "Poslovna analitika", desc: "Vizuelni prikaz prihoda po mesecima i klijentima." },
];

const comparison = [
  { aspect: "Kreiranje fakture", before: "30+ minuta ručno", after: "2 minuta automatski" },
  { aspect: "KPO knjiga", before: "Excel tabele, greške", after: "Automatski generisano" },
  { aspect: "Praćenje limita", before: "Ručno računanje", after: "Real-time praćenje" },
  { aspect: "Poreski rokovi", before: "Zaboravljanje, kazne", after: "Automatski podsetnici" },
];

const benefits = [
  "Sve na jednom mestu – fakture, evidencija, podsetnici",
  "Usklađeno sa srpskim propisima za paušalce",
  "Pristup sa bilo kog uređaja",
  "Sigurnost podataka u cloud-u",
  "Automatski backup svih dokumenata",
];

// Wavy SVG separator component
const WaveSeparator = ({ flip = false, color = "#F8FAFC" }: { flip?: boolean; color?: string }) => (
  <div className={`w-full overflow-hidden ${flip ? 'rotate-180' : ''}`}>
    <svg 
      viewBox="0 0 1440 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
      preserveAspectRatio="none"
    >
      <path 
        d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" 
        fill={color}
      />
    </svg>
  </div>
);

// Floating Invoice Mockup Component
const InvoiceMockup = () => (
  <motion.div
    className="relative"
    initial={{ opacity: 0, x: 100 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.8, delay: 0.3 }}
  >
    <motion.div
      className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-sm"
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Invoice Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-bold text-slate-900 text-lg">FAKTURA #2024-042</h4>
          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full mt-1">
            Plaćeno
          </span>
        </div>
        {/* Limit Badge */}
        <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
          <div className="text-xs text-slate-500 mb-1">Godišnji limit</div>
          <div className="flex items-center gap-1">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="w-5 h-full bg-yellow-500 rounded-full"></div>
            </div>
            <span className="text-xs font-medium text-slate-700">2.5M</span>
            <span className="text-xs text-slate-400">/ 6M RSD</span>
          </div>
        </div>
      </div>

      {/* QR Code and Amount */}
      <div className="flex items-start gap-4 mb-4">
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="w-16 h-16 bg-white rounded grid grid-cols-5 grid-rows-5 gap-0.5 p-1">
            {[...Array(25)].map((_, i) => (
              <div key={i} className={`${Math.random() > 0.5 ? 'bg-slate-900' : 'bg-white'} rounded-[1px]`} />
            ))}
          </div>
          <div className="text-xs text-center text-slate-500 mt-1">IPS QR</div>
        </div>
        <div className="flex-1 text-right">
          <div className="text-sm text-slate-500">Ukupno za uplatu</div>
          <div className="text-2xl font-bold text-slate-900">54.000 <span className="text-lg text-slate-600">RSD</span></div>
        </div>
      </div>

      {/* Invoice Items */}
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Web dizajn - Premium paket</span>
          <span className="font-medium text-slate-900">45.000 RSD</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Hosting (godišnji)</span>
          <span className="font-medium text-slate-900">9.000 RSD</span>
        </div>
      </div>

      {/* KPO Indicator */}
      <div className="mt-4 flex items-center gap-2 bg-yellow-50 rounded-lg p-2 border border-yellow-200">
        <BookOpen className="h-4 w-4 text-yellow-600" />
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-900">KPO Knjiga</div>
          <div className="text-xs text-slate-500">Automatski ažurirano</div>
        </div>
      </div>
    </motion.div>

    {/* Floating Trend Badge */}
    <motion.div
      className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg border border-slate-200 p-3 flex items-center gap-2"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.8 }}
    >
      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
        <TrendingUp className="h-4 w-4 text-emerald-600" />
      </div>
    </motion.div>
  </motion.div>
);

export default function Index() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <img src={logo} alt="Paušal box" className="h-8" />
          </div>
          <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold">
            <Link to="/auth">Prijavi se</Link>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative py-16 md:py-24 bg-white overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <motion.div 
                className="space-y-6"
                initial="initial"
                animate="animate"
                variants={staggerContainer}
              >
                <motion.span 
                  className="inline-block px-4 py-1.5 rounded-full border border-yellow-300 bg-yellow-100 text-sm font-medium text-slate-800"
                  variants={fadeInUp}
                >
                  ✨ Za paušalno oporezovane preduzetnike
                </motion.span>
                <motion.h1 
                  className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-tight"
                  variants={fadeInUp}
                >
                  Uštedite <span className="text-yellow-500">8+ sati mesečno</span> na administraciji
                </motion.h1>
                <motion.p 
                  className="text-lg md:text-xl text-slate-600 max-w-xl"
                  variants={fadeInUp}
                >
                  Više od 500 paušalaca u Srbiji koristi Paušal Box za automatsko fakturisanje, vođenje KPO knjige i praćenje limita. Pridružite im se danas.
                </motion.p>
                <motion.div 
                  className="flex flex-col sm:flex-row gap-4 pt-4"
                  variants={fadeInUp}
                >
                  <Button size="lg" asChild className="text-base bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold shadow-lg shadow-yellow-500/25 transition-all duration-300 hover:scale-105">
                    <Link to="/auth">
                      Besplatno testirajte
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="text-base border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
                    <a href="#cenovnik">Pogledajte cene</a>
                  </Button>
                </motion.div>
              </motion.div>

              {/* Right Content - Invoice Mockup */}
              <div className="hidden lg:flex justify-center">
                <InvoiceMockup />
              </div>
            </div>
          </div>
        </section>

        {/* Wave Separator */}
        <WaveSeparator color="#F8FAFC" />

        {/* Stats Section */}
        <section className="py-16 bg-slate-50">
          <div className="container mx-auto px-4">
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">Rezultati koji govore</h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Konkretni brojevi koji pokazuju vrednost Paušal Box aplikacije za naše korisnike.
              </p>
            </motion.div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <motion.div 
                  key={stat.label}
                  className="text-center p-6 rounded-2xl bg-white border border-slate-200 hover:shadow-lg transition-shadow duration-300"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  whileHover={{ y: -5 }}
                >
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-yellow-100 flex items-center justify-center">
                    {index === 0 && <Clock className="h-7 w-7 text-yellow-600" />}
                    {index === 1 && <Users className="h-7 w-7 text-yellow-600" />}
                    {index === 2 && <FileCheck className="h-7 w-7 text-yellow-600" />}
                    {index === 3 && <Target className="h-7 w-7 text-yellow-600" />}
                  </div>
                  <div className="text-4xl md:text-5xl font-bold text-yellow-500 mb-2">{stat.value}</div>
                  <div className="font-semibold text-slate-900">{stat.label}</div>
                  <div className="text-sm text-slate-500 mt-1">{stat.sublabel}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        
        {/* Wave Separator (flip) */}
        <WaveSeparator flip color="#FFFFFF" />

        {/* Features Section */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container mx-auto px-4">
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">Funkcionalnosti</h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Sve što vam je potrebno za vođenje paušalnog biznisa na jednom mestu.
              </p>
            </motion.div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <motion.div 
                  key={feature.title}
                  className="p-6 rounded-2xl bg-white border border-slate-200 hover:shadow-xl hover:border-yellow-300 transition-all duration-300"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -5 }}
                >
                  <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-yellow-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-slate-900">{feature.title}</h3>
                  <p className="text-slate-600 text-sm">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="py-16 bg-slate-50 border-y border-slate-200">
          <div className="container mx-auto px-4">
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">Pre i posle Paušal Box-a</h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Pogledajte kako naša aplikacija transformiše vaše svakodnevne zadatke.
              </p>
            </motion.div>
            <motion.div 
              className="max-w-3xl mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="overflow-x-auto">
              <div className="grid grid-cols-3 bg-slate-100 font-semibold text-sm min-w-[500px]">
                <div className="p-3 sm:p-4 text-slate-700">Aspekt</div>
                <div className="p-3 sm:p-4 text-center text-red-500">Bez aplikacije</div>
                <div className="p-3 sm:p-4 text-center text-emerald-600">Sa aplikacijom</div>
              </div>
              {comparison.map((item, index) => (
                <motion.div 
                  key={item.aspect}
                  className="grid grid-cols-3 border-t border-slate-200 bg-white min-w-[500px]"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="p-3 sm:p-4 font-medium text-slate-900 text-sm">{item.aspect}</div>
                  <div className="p-3 sm:p-4 text-center text-slate-600 flex items-center justify-center gap-1 sm:gap-2">
                    <X className="h-3 w-3 sm:h-4 sm:w-4 text-red-400 shrink-0" />
                    <span className="text-xs sm:text-sm">{item.before}</span>
                  </div>
                  <div className="p-3 sm:p-4 text-center flex items-center justify-center gap-1 sm:gap-2">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500 shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-emerald-600">{item.after}</span>
                  </div>
                </motion.div>
              ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Why Section */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900">Zašto <span className="text-yellow-500">Paušal Box</span>?</h2>
                <p className="text-slate-600 mb-8">
                  Kao paušalac, imate mnogo obaveza – fakturisanje, vođenje evidencije, praćenje limita, plaćanje poreza. Paušal Box sve to automatizuje i pojednostavljuje.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <motion.li 
                      key={index}
                      className="flex items-start gap-3"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="w-5 h-5 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3 w-3 text-yellow-600" />
                      </div>
                      <span className="text-slate-700">{benefit}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
              <motion.div
                className="relative"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="aspect-square rounded-3xl bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center">
                  <img src={logo} alt="Paušal Box" className="w-1/2 opacity-80" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="cenovnik" className="py-16 bg-slate-50 border-y border-slate-200">
          <div className="container mx-auto px-4">
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">Cenovnik</h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Izaberite plan koji odgovara vašim potrebama. Svi planovi uključuju besplatan probni period.
              </p>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { name: "Mesečni", price: "990", period: "mesečno", features: ["Sve funkcionalnosti", "Email podrška", "Izvoz podataka"], popular: false, planMonths: 1 },
                { name: "Polugodišnji", price: "4.950", period: "6 meseci", features: ["Sve funkcionalnosti", "Prioritetna podrška", "Izvoz podataka"], popular: true, badge: "Ušteda 17%", planMonths: 6 },
                { name: "Godišnji", price: "9.990", period: "godišnje", features: ["Sve funkcionalnosti", "Premium podrška", "Prioritetni pristup novim funkcijama"], popular: false, badge: "Ušteda 16%", planMonths: 12 },
              ].map((plan, index) => (
                <motion.div 
                  key={plan.name}
                  className={`relative p-6 rounded-2xl border ${plan.popular ? 'border-yellow-500 bg-yellow-50 shadow-lg' : 'border-slate-200 bg-white'}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -5 }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-500 text-slate-900 text-xs font-semibold rounded-full">
                      Najpopularnije
                    </div>
                  )}
                  {plan.badge && !plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-200 text-slate-700 text-xs font-semibold rounded-full">
                      {plan.badge}
                    </div>
                  )}
                  <h3 className="font-semibold text-lg mb-1 text-slate-900">{plan.name}</h3>
                  <p className="text-slate-600 text-sm mb-4">
                    {plan.popular ? "Ušteda 17%" : plan.name === "Mesečni" ? "Za nove korisnike" : "Ušteda 16%"}
                  </p>
                  <div className="mb-6">
                    <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                    <span className="text-slate-600">din/{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-slate-700">
                        <Check className="h-4 w-4 text-yellow-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    asChild 
                    className={`w-full ${plan.popular ? 'bg-yellow-500 hover:bg-yellow-600 text-slate-900' : ''}`} 
                    variant={plan.popular ? "default" : "outline"}
                  >
                    <Link to={`/auth?plan=${plan.planMonths}`}>Započni besplatno</Link>
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container mx-auto px-4">
            <motion.div 
              className="max-w-3xl mx-auto text-center space-y-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Spremni da pojednostavite vaš paušalni biznis?</h2>
              <p className="text-slate-600 text-lg">
                Pridružite se stotinama paušalaca koji već koriste Paušal Box.
              </p>
              <Button size="lg" asChild className="text-base bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold shadow-lg shadow-yellow-500/25">
                <Link to="/auth">
                  Započnite besplatno
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 bg-white">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          <img src={logo} alt="Paušal Box" className="h-6 mx-auto mb-4 opacity-60" />
          <p>© {new Date().getFullYear()} Paušal Box. Sva prava zadržana.</p>
        </div>
      </footer>
    </div>
  );
}
