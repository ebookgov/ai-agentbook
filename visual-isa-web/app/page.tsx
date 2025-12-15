import { listings } from "@/lib/data";
import { ListingCard } from "@/components/ListingCard";
import { MortgageCalculator } from "@/components/MortgageCalculator";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/40 z-10" />
          <div
            className="w-full h-full bg-[url('https://images.unsplash.com/photo-1600596542815-e25fa110825b?q=80&w=2675&auto=format&fit=crop')] bg-cover bg-center"
          />
        </div>

        <div className="relative z-20 text-center text-white px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-serif mb-6 leading-tight">
            Discover Your <span className="text-secondary italic">Perfect</span> Sanctuary
          </h1>
          <p className="text-lg md:text-xl font-light tracking-wide max-w-2xl mx-auto mb-10 text-white/90">
            Exclusive estates, architectural masterpieces, and luxury living in the heart of Los Angeles.
          </p>
          <button className="bg-secondary text-primary-foreground px-8 py-3 rounded-md text-sm uppercase tracking-widest font-semibold hover:bg-secondary/90 transition-all transform hover:scale-105">
            Explore Collection
          </button>
        </div>
      </section>

      {/* Listings Section */}
      <section className="py-24 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-end justify-between mb-12">
          <div>
            <h2 className="text-sm font-semibold text-secondary uppercase tracking-widest mb-2">Curated Selection</h2>
            <h3 className="text-4xl font-serif text-primary">Featured Estates</h3>
          </div>
          <button className="hidden md:block text-sm font-medium border-b border-primary pb-1 hover:text-secondary hover:border-secondary transition-colors">
            View All Properties
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {listings.map((listing, index) => (
            <ListingCard key={listing.id} listing={listing} index={index} />
          ))}
        </div>
      </section>

      {/* Calculator Section */}
      <section className="bg-muted/30 py-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-serif text-primary mb-6">Finance Your Dream</h2>
            <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
              Our integrated mortgage tools help you plan your investment with precision.
              Explore financing options tailored to your portfolio.
            </p>
            <ul className="space-y-4 mb-8">
              {['Jumbo Loans Available', 'Competitive Interest Rates', 'Expert Financial Advisory'].map((item) => (
                <li key={item} className="flex items-center text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary mr-3" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:pl-12">
            <MortgageCalculator />
          </div>
        </div>
      </section>
    </main>
  );
}
