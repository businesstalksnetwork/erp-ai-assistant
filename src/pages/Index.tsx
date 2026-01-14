import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, Bell, ArrowRight, FileText, QrCode, LineChart, 
  Clock, Users, FileCheck, Target, Check, X
} from 'lucide-react';
import { motion } from 'framer-motion';
import logo from '@/assets/pausal-box-logo.png';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
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
        <section className="container mx-auto px-4 py-16 md:py-24 bg-white">
          <motion.div 
            className="max-w-3xl mx-auto text-center space-y-6"
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
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900"
              variants={fadeInUp}
            >
              Uštedite <span className="text-yellow-500">8+ sati mesečno</span> na administraciji
            </motion.h1>
            <motion.p 
              className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto"
              variants={fadeInUp}
            >
              Više od 500 paušalaca u Srbiji koristi Paušal Box za automatsko fakturisanje, vođenje KPO knjige i praćenje limita. Pridružite im se danas.
            </motion.p>
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center pt-4"
              variants={fadeInUp}
            >
              <Button size="lg" asChild className="text-base bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold shadow-lg shadow-yellow-500/25">
                <Link to="/auth">
                  Besplatno testirajte
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-base border-slate-300 text-slate-700 hover:bg-slate-50">
                <a href="#cenovnik">Pogledajte cene</a>
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-slate-50 border-y border-slate-200">
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
                  className="text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 flex items-center justify-center">
                    {index === 0 && <Clock className="h-8 w-8 text-yellow-600" />}
                    {index === 1 && <Users className="h-8 w-8 text-yellow-600" />}
                    {index === 2 && <FileCheck className="h-8 w-8 text-yellow-600" />}
                    {index === 3 && <Target className="h-8 w-8 text-yellow-600" />}
                  </div>
                  <div className="text-4xl md:text-5xl font-bold text-yellow-500 mb-2">{stat.value}</div>
                  <div className="font-semibold text-slate-900">{stat.label}</div>
                  <div className="text-sm text-slate-600">{stat.sublabel}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

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
              <div className="grid grid-cols-3 bg-slate-100 font-semibold text-sm">
                <div className="p-4 text-slate-700">Aspekt</div>
                <div className="p-4 text-center text-red-500">Bez aplikacije</div>
                <div className="p-4 text-center text-emerald-600">Sa aplikacijom</div>
              </div>
              {comparison.map((item, index) => (
                <motion.div 
                  key={item.aspect}
                  className="grid grid-cols-3 border-t border-slate-200 bg-white"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="p-4 font-medium text-slate-900">{item.aspect}</div>
                  <div className="p-4 text-center text-slate-600 flex items-center justify-center gap-2">
                    <X className="h-4 w-4 text-red-400" />
                    <span className="text-sm">{item.before}</span>
                  </div>
                  <div className="p-4 text-center flex items-center justify-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-600">{item.after}</span>
                  </div>
                </motion.div>
              ))}
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
                { name: "Mesečni", price: "990", period: "mesečno", features: ["Sve funkcionalnosti", "Email podrška", "Izvoz podataka"], popular: false },
                { name: "Polugodišnji", price: "4.950", period: "6 meseci", features: ["Sve funkcionalnosti", "Prioritetna podrška", "Izvoz podataka"], popular: true, badge: "Ušteda 17%" },
                { name: "Godišnji", price: "9.990", period: "godišnje", features: ["Sve funkcionalnosti", "Premium podrška", "Prioritetni pristup novim funkcijama"], popular: false, badge: "Ušteda 16%" },
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
                    <Link to="/auth">Započni besplatno</Link>
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
