import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Utensils, ShoppingCart, Heart } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Generation",
    description: "Advanced AI creates personalized recipes based on your preferences and dietary needs."
  },
  {
    icon: Utensils,
    title: "Diverse Cuisines",
    description: "Explore recipes from around the world, adapted to your dietary restrictions."
  },
  {
    icon: ShoppingCart,
    title: "Smart Grocery Lists",
    description: "Automatically generate shopping lists from your favorite recipes."
  },
  {
    icon: Heart,
    title: "Health-Focused",
    description: "All recipes include nutritional information and health-conscious options."
  }
];

export function FeaturesSection() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Why Choose CulinaryAI Chef?
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Our AI-powered recipe generator creates personalized culinary experiences
            tailored to your unique dietary needs and taste preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="text-center">
                <CardHeader>
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}