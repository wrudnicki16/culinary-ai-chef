import Image from "next/image";
import { SearchSection } from "./search-section";

interface HeroSectionProps {
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function HeroSection({ onSearchChange }: HeroSectionProps) {
  return (
    <section className="rounded-2xl overflow-hidden mb-8 relative">
      <div className="h-64 md:h-80 bg-gray-200 relative">
        <Image
          src="https://images.unsplash.com/photo-1506368249639-73a05d6f6488?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1920&h=600"
          alt="Fresh ingredients showcasing variety of cooking ingredients for AI recipe generation"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900/70 to-gray-900/30"></div>
        <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-12">
          <h2 className="text-white text-2xl md:text-4xl font-display font-bold mb-4">
            Discover AI-Powered Recipes
          </h2>
          <p className="text-white text-sm md:text-base max-w-xl mb-6">
            Get personalized recipe recommendations based on your dietary
            preferences and available ingredients.
          </p>
          <SearchSection onSearchChange={onSearchChange} />
        </div>
      </div>
    </section>
  );
}