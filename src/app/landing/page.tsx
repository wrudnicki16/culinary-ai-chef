import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import {
  Filter,
  Heart,
  Cpu,
  ShoppingCart,
  CheckCircle2,
  BadgeCheck,
  Sparkles
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-primary/90 to-primary/70 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
            <div className="md:w-2/3">
              <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">
                AI-Powered Recipe Generation For Everyone
              </h1>
              <p className="text-xl opacity-90 mb-8">
                Find the perfect recipe for any dietary need or preference with our advanced AI recipe generator. 
                Enter your ingredients, specify your dietary requirements, and let AI do the rest.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild className="bg-white text-primary hover:bg-white/90">
                  <Link href="/api/auth/signin">Get Started</Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white bg-white/20 text-white hover:bg-white/30" asChild>
                  <Link href="#features">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-0 w-full overflow-hidden leading-none">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none" className="h-20 w-full">
              <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className="fill-background"></path>
            </svg>
          </div>
        </section>
        
        {/* Features Section */}
        <section id="features" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-display font-bold mb-4">Why Choose Our Recipe Generator?</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Powered by advanced AI and deep nutritional research, our platform makes finding the perfect recipe simple and accessible.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full mb-6">
                  <Cpu className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">AI-Powered Intelligence</h3>
                <p className="text-gray-600">
                  Our advanced AI analyzes thousands of recipes to create personalized recommendations based on your preferences.
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full mb-6">
                  <Filter className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">Comprehensive Filtering</h3>
                <p className="text-gray-600">
                  Filter by dietary needs including high protein, vegan, keto, gluten-free, heart healthy, and many more options.
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full mb-6">
                  <CheckCircle2 className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">Safety Validation</h3>
                <p className="text-gray-600">
                  Every recipe undergoes strict safety validation to ensure ingredient compatibility and balanced nutrition.
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full mb-6">
                  <Heart className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">Health-Focused</h3>
                <p className="text-gray-600">
                  Find recipes that align with your health goals, from high-protein fitness diets to heart-healthy options.
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full mb-6">
                  <ShoppingCart className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">Grocery Integration</h3>
                <p className="text-gray-600">
                  Send ingredients directly to your favorite grocery delivery services with a single click.
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full mb-6">
                  <BadgeCheck className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">Community Rated</h3>
                <p className="text-gray-600">
                  Browse recipes with verified ratings and reviews from real users to find trusted favorites.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="bg-gray-50 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center bg-primary/10 px-4 py-2 rounded-full text-primary mb-6">
              <Sparkles className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Start cooking smarter today</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">Ready to Discover Recipes Tailored to You?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Join thousands of users who have transformed their cooking experience with AI-powered recipe recommendations.
            </p>
            <Button size="lg" asChild>
              <Link href="/api/auth/signin">Get Started For Free</Link>
            </Button>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
