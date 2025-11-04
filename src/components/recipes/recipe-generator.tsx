import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils, Filter, AlertTriangle, X, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AILoadingModal } from "./ai-loading-modal";
import { Recipe } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Badge } from "@/components/ui/badge";
import { DIETARY_FILTERS, detectContradictoryFilters } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";

interface RecipeGeneratorProps {
  onRecipeGenerated: (recipe: Recipe) => void;
}

export function RecipeGenerator({ onRecipeGenerated }: RecipeGeneratorProps) {
  const { status } = useSession();
  const [prompt, setPrompt] = useState("");
  const [selectedDietaryFilters, setSelectedDietaryFilters] = useState<string[]>([]);
  const [selectedCuisine, setSelectedCuisine] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState("dietType");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showProteinDialog, setShowProteinDialog] = useState(false);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [userWeight, setUserWeight] = useState<string>("70");
  const [weightUnit, setWeightUnit] = useState<string>("kg");
  const [activityLevel, setActivityLevel] = useState<string>("moderate");
  const [generatorTab, setGeneratorTab] = useState("prompt");
  const [selectedMealType, setSelectedMealType] = useState("any");
  const [isCancelled, setIsCancelled] = useState(false);
  const [visibleCuisines, setVisibleCuisines] = useState(10);
  const { toast } = useToast();

  // Detect contradictory dietary filters
  const filterContradictions = detectContradictoryFilters(selectedDietaryFilters);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  // We'll handle the protein dialog through the toggleFilter function instead
  // This prevents the dialog from showing for every filter after high-protein was selected once

  // Calculate personalized protein intake based on weight and activity level
  const calculatePersonalizedProtein = (): string => {
    const weightInKg = weightUnit === 'kg'
      ? parseFloat(userWeight)
      : parseFloat(userWeight) * 0.453592; // Convert lbs to kg

    // Protein multiplier based on activity level (g per kg of body weight)
    let proteinMultiplier = 0.8; // Base recommendation

    switch (activityLevel) {
      case 'sedentary':
        proteinMultiplier = 0.8;
        break;
      case 'moderate':
        proteinMultiplier = 1.2;
        break;
      case 'active':
        proteinMultiplier = 1.6;
        break;
      case 'athlete':
        proteinMultiplier = 2.0;
        break;
      default:
        proteinMultiplier = 1.2;
    }

    return (weightInKg * proteinMultiplier).toFixed(0);
  };

  const toggleFilter = (filter: string) => {
    // Only show protein dialog when adding (not removing) high protein filter
    if (filter === 'highProtein' && !selectedDietaryFilters.includes(filter)) {
      setShowProteinDialog(true);
    }

    setSelectedDietaryFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const handleCuisineSelection = (cuisineId: string) => {
    setSelectedCuisine(cuisineId === selectedCuisine ? '' : cuisineId);
  };

  const resetAllFilters = () => {
    setSelectedDietaryFilters([]);
    setSelectedCuisine('');
  };

  const getFilterLabel = (filterId: string): string => {
    for (const category in DIETARY_FILTERS) {
      const filter = DIETARY_FILTERS[category as keyof typeof DIETARY_FILTERS].find(f => f.id === filterId);
      if (filter) return filter.label;
    }
    return filterId;
  };

  const handleGenerateRecipe = async () => {
    if (generatorTab === "prompt" && !prompt.trim()) {
      toast({
        title: "Empty prompt",
        description: "Please describe what you'd like to cook.",
        variant: "destructive",
      });
      return;
    }

    // Check for contradictory filters and show confirmation dialog
    if (filterContradictions.hasContradictions) {
      setShowConfirmationDialog(true);
      return;
    }

    // Proceed with recipe generation
    await proceedWithGeneration();
  };

  const proceedWithGeneration = async () => {
    // Reset cancellation flag and set up state
    setIsCancelled(false);
    setIsGenerating(true);
    setGenerationProgress(0);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        const newProgress = prev + (Math.random() * 15);
        return newProgress > 95 ? 95 : newProgress;
      });
    }, 800);

    try {
      let luckyPrompt = "Generate a random, creative recipe that would surprise and delight me. Be inventive with ingredients and cooking techniques.";
      if (generatorTab === "lucky" && selectedMealType !== "any") {
        luckyPrompt = `Generate a random, creative ${selectedMealType} recipe that would surprise and delight me. Be inventive with ingredients and cooking techniques suitable for ${selectedMealType}.`;
      }

      const allFilters = [...selectedDietaryFilters];
      if (selectedCuisine) {
        allFilters.push(selectedCuisine);
      }

      const response = await apiRequest("POST", "/api/recipes/generate", {
        prompt: generatorTab === "prompt" ? prompt.trim() : luckyPrompt,
        dietaryFilters: allFilters
      });

      // Check if the operation was cancelled during the request
      if (isCancelled) {
        clearInterval(progressInterval);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to generate recipe");
      }

      const recipe = await response.json();

      // Check if cancelled before processing the result
      if (isCancelled) {
        clearInterval(progressInterval);
        return;
      }

      setGenerationProgress(100);

      // Slight delay to show 100% completion
      setTimeout(() => {
        if (!isCancelled) {
          setIsGenerating(false);
          clearInterval(progressInterval);

          // Invalidate recipe queries to refetch the list after generating a new one
          queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });

          // Pass the newly generated recipe up to the parent component
          onRecipeGenerated(recipe);
        }
      }, 500);
    } catch (error: unknown) {
      // Clean up the interval and state
      clearInterval(progressInterval);

      // Don't show error if user cancelled
      if (isCancelled) {
        return;
      }

      setIsGenerating(false);

      // Handle authentication errors
      if (isUnauthorizedError(error)) {
        toast({
          title: "Authentication required",
          description: "You need to be logged in to generate recipes. Redirecting to login...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/auth/signin";
        }, 1500);
        return;
      }

      toast({
        title: "Recipe generation failed",
        description: "There was an error generating your recipe. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle cancellation of recipe generation
  const handleCancelGeneration = () => {
    setIsCancelled(true);
    setIsGenerating(false);
    setGenerationProgress(0);

    toast({
      title: "Recipe generation cancelled",
      description: "Recipe generation was cancelled.",
      variant: "default",
    });
  };

  // Handle protein dialog submission
  const handleProteinSubmit = () => {
    const proteinTarget = calculatePersonalizedProtein();

    // Update the prompt with personalized protein information
    setPrompt(prev => {
      const proteinInfo = `I need a high-protein meal with approximately ${proteinTarget}g of protein. `;
      // If the prompt already contains high-protein info, don&apos;t duplicate it
      if (prev.toLowerCase().includes('high-protein') || prev.toLowerCase().includes('protein')) {
        return prev;
      }
      return proteinInfo + prev;
    });

    setShowProteinDialog(false);
  };

  // Show authentication prompt for unauthenticated users
  if (status === "unauthenticated") {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg flex justify-between items-center">
            <span>Generate a Recipe with AI</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <LogIn className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sign in to generate recipes</h3>
            <p className="text-sm text-gray-600 mb-6">
              Access our AI-powered recipe generator by signing in to your account.
            </p>
            <Button
              onClick={() => window.location.href = "/api/auth/signin"}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 mx-auto"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg flex justify-between items-center">
            <span>Generate a Recipe with AI</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Protein Personalization Dialog */}
      <Dialog open={showProteinDialog} onOpenChange={setShowProteinDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Personalize Your Protein Intake</DialogTitle>
            <DialogDescription>
              Enter your details to get personalized high-protein recipes based on your body weight and activity level.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="weight" className="text-right">
                Weight
              </Label>
              <Input
                id="weight"
                type="number"
                value={userWeight}
                onChange={(e) => setUserWeight(e.target.value)}
                className="col-span-2"
              />
              <Select value={weightUnit} onValueChange={setWeightUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="kg" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lbs">lbs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="activity" className="text-right">
                Activity
              </Label>
              <Select value={activityLevel} onValueChange={setActivityLevel}>
                <SelectTrigger id="activity" className="col-span-3">
                  <SelectValue placeholder="Select activity level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary (little exercise)</SelectItem>
                  <SelectItem value="moderate">Moderate (3-5 days/week)</SelectItem>
                  <SelectItem value="active">Active (5-7 days/week)</SelectItem>
                  <SelectItem value="athlete">Athlete (2x per day)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-4">
                <p className="text-sm text-muted-foreground">
                  Your recommended daily protein intake: <span className="font-bold">{calculatePersonalizedProtein()}g</span>
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleProteinSubmit}>
              Apply to Recipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Contradictory Filters */}
      <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Challenging Filter Combination
            </DialogTitle>
            <DialogDescription>
              We&apos;ve detected some dietary filters that may be difficult to combine. Our AI will do its best to create a recipe that meets your requirements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {filterContradictions.warnings.map((warning, index) => (
              <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">{warning}</p>
              </div>
            ))}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>What happens next:</strong> Our AI will attempt to create a recipe that satisfies as many of your selected filters as possible. The result might emphasize some dietary requirements over others.
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmationDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setShowConfirmationDialog(false);
                await proceedWithGeneration();
              }}
              className="bg-primary hover:bg-primary/90"
            >
              Try Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg flex justify-between items-center">
            <span>Generate a Recipe with AI</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="text-gray-500 hover:text-primary"
              >
                <Filter className="h-4 w-4 mr-2" />
                <span>Dietary Filters</span>
              </Button>
              {(selectedDietaryFilters.length > 0 || selectedCuisine) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetAllFilters}
                  className="text-gray-500 hover:text-red-500 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={generatorTab} onValueChange={setGeneratorTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="prompt">Custom Recipe</TabsTrigger>
              <TabsTrigger value="lucky">Feeling Lucky</TabsTrigger>
            </TabsList>

            <TabsContent value="prompt" className="space-y-4">
              {showFilters && (
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <Tabs
                    defaultValue="dietType"
                    value={activeFilterTab}
                    onValueChange={setActiveFilterTab}
                    className="w-full"
                  >
                    <TabsList className="mb-2">
                      <TabsTrigger value="dietType">Diet Type</TabsTrigger>
                      <TabsTrigger value="allergies">Allergies</TabsTrigger>
                      <TabsTrigger value="health">Health</TabsTrigger>
                      <TabsTrigger value="trending">Trending</TabsTrigger>
                      <TabsTrigger value="cuisines">Cuisines</TabsTrigger>
                    </TabsList>

                    {Object.entries(DIETARY_FILTERS).map(([category, filters]) => (
                      <TabsContent key={category} value={category} className="mt-0">
                        {category === 'cuisines' ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {filters.slice(0, visibleCuisines).map((filter) => (
                                <Badge
                                  key={filter.id}
                                  variant={selectedCuisine === filter.id ? "default" : "outline"}
                                  className={selectedCuisine === filter.id
                                    ? "cursor-pointer bg-primary hover:bg-primary/80"
                                    : "cursor-pointer hover:bg-gray-100"}
                                  onClick={() => handleCuisineSelection(filter.id)}
                                >
                                  {filter.label}
                                </Badge>
                              ))}
                            </div>
                            {visibleCuisines < filters.length && (
                              <div className="mt-3 text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setVisibleCuisines(prev => Math.min(prev + 10, filters.length))}
                                  className="text-gray-600 hover:text-gray-800"
                                >
                                  Load More ({filters.length - visibleCuisines} remaining)
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {filters.map((filter) => (
                              <Badge
                                key={filter.id}
                                variant={selectedDietaryFilters.includes(filter.id) ? "default" : "outline"}
                                className={selectedDietaryFilters.includes(filter.id)
                                  ? "cursor-pointer bg-primary hover:bg-primary/80"
                                  : "cursor-pointer hover:bg-gray-100"}
                                onClick={() => toggleFilter(filter.id)}
                              >
                                {filter.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              )}

              <div>
                <label
                  htmlFor="recipe-prompt"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  What would you like to cook?
                </label>
                <Textarea
                  id="recipe-prompt"
                  value={prompt}
                  onChange={handlePromptChange}
                  placeholder="Describe what you want to make, ingredients you have, or dietary restrictions..."
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary h-24"
                />
              </div>

              {(selectedDietaryFilters.length > 0 || selectedCuisine) && (
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Applied filters:</span> {[
                    ...selectedDietaryFilters.map(getFilterLabel),
                    ...(selectedCuisine ? [getFilterLabel(selectedCuisine)] : [])
                  ].join(", ")}
                </div>
              )}

              <div className="text-right">
                <Button
                  onClick={handleGenerateRecipe}
                  disabled={isGenerating || !prompt.trim()}
                  className="bg-secondary hover:bg-secondary/90 text-white px-5 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ml-auto"
                >
                  <Utensils className="h-5 w-5" />
                  <span>Generate Recipe</span>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="lucky" className="space-y-4">
              {showFilters && (
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <Tabs
                    defaultValue="dietType"
                    value={activeFilterTab}
                    onValueChange={setActiveFilterTab}
                    className="w-full"
                  >
                    <TabsList className="mb-2">
                      <TabsTrigger value="dietType">Diet Type</TabsTrigger>
                      <TabsTrigger value="allergies">Allergies</TabsTrigger>
                      <TabsTrigger value="health">Health</TabsTrigger>
                      <TabsTrigger value="trending">Trending</TabsTrigger>
                      <TabsTrigger value="cuisines">Cuisines</TabsTrigger>
                    </TabsList>

                    {Object.entries(DIETARY_FILTERS).map(([category, filters]) => (
                      <TabsContent key={category} value={category} className="mt-0">
                        {category === 'cuisines' ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {filters.slice(0, visibleCuisines).map((filter) => (
                                <Badge
                                  key={filter.id}
                                  variant={selectedCuisine === filter.id ? "default" : "outline"}
                                  className={selectedCuisine === filter.id
                                    ? "cursor-pointer bg-primary hover:bg-primary/80"
                                    : "cursor-pointer hover:bg-gray-100"}
                                  onClick={() => handleCuisineSelection(filter.id)}
                                >
                                  {filter.label}
                                </Badge>
                              ))}
                            </div>
                            {visibleCuisines < filters.length && (
                              <div className="mt-3 text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setVisibleCuisines(prev => Math.min(prev + 10, filters.length))}
                                  className="text-gray-600 hover:text-gray-800"
                                >
                                  Load More ({filters.length - visibleCuisines} remaining)
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {filters.map((filter) => (
                              <Badge
                                key={filter.id}
                                variant={selectedDietaryFilters.includes(filter.id) ? "default" : "outline"}
                                className={selectedDietaryFilters.includes(filter.id)
                                  ? "cursor-pointer bg-primary hover:bg-primary/80"
                                  : "cursor-pointer hover:bg-gray-100"}
                                onClick={() => toggleFilter(filter.id)}
                              >
                                {filter.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              )}

              <div className="py-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for a culinary adventure?</h3>
                  <p className="text-sm text-gray-600">
                    Let our AI surprise you with a creative, random recipe that might become your new favorite!
                  </p>
                </div>

                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-700 mb-3 block">What type of recipe would you like?</Label>
                  <RadioGroup
                    value={selectedMealType}
                    onValueChange={setSelectedMealType}
                    className="grid grid-cols-2 gap-4 sm:grid-cols-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="any" id="any" />
                      <Label htmlFor="any" className="text-sm cursor-pointer">Any</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="breakfast" id="breakfast" />
                      <Label htmlFor="breakfast" className="text-sm cursor-pointer">Breakfast</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="lunch" id="lunch" />
                      <Label htmlFor="lunch" className="text-sm cursor-pointer">Lunch</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="dinner" id="dinner" />
                      <Label htmlFor="dinner" className="text-sm cursor-pointer">Dinner</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="snack" id="snack" />
                      <Label htmlFor="snack" className="text-sm cursor-pointer">Snack</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="dessert" id="dessert" />
                      <Label htmlFor="dessert" className="text-sm cursor-pointer">Dessert</Label>
                    </div>
                  </RadioGroup>
                </div>

                {(selectedDietaryFilters.length > 0 || selectedCuisine) && (
                  <div className="text-xs text-gray-500 mb-4 text-center">
                    <span className="font-medium">Applied filters:</span> {[
                      ...selectedDietaryFilters.map(getFilterLabel),
                      ...(selectedCuisine ? [getFilterLabel(selectedCuisine)] : [])
                    ].join(", ")}
                  </div>
                )}

                <div className="text-center">
                  <div className="relative inline-flex items-center">
                    <Button
                      onClick={handleGenerateRecipe}
                      disabled={isGenerating}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                    >
                      <div className="text-xl">🎲</div>
                      <span>Surprise Me!</span>
                    </Button>

                    {filterContradictions.hasContradictions && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="absolute -right-8 top-1/2 -translate-y-1/2 flex items-center">
                              <AlertTriangle className="h-5 w-5 text-yellow-500 hover:text-yellow-600 cursor-help" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <div className="space-y-1">
                              <p className="font-medium text-sm">Contradictory Filters Detected</p>
                              {filterContradictions.warnings.map((warning, index) => (
                                <p key={index} className="text-xs text-muted-foreground">
                                  {warning}
                                </p>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AILoadingModal
        isOpen={isGenerating}
        progress={generationProgress}
        onCancel={handleCancelGeneration}
      />
    </>
  );
}
