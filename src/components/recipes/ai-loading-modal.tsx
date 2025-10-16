import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface AILoadingModalProps {
  isOpen: boolean;
  progress: number;
  onCancel?: () => void;
}

export function AILoadingModal({ isOpen, progress, onCancel }: AILoadingModalProps) {
  // Calculate which stage we're in based on progress
  const getStageMessage = () => {
    if (progress < 30) return "Analyzing ingredients";
    if (progress < 60) return "Creating recipe";
    if (progress < 90) return "Validating nutrition";
    return "Finalizing recipe";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && onCancel) {
        onCancel();
      }
    }}>
      <DialogContent className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center" onInteractOutside={(e) => e.preventDefault()}>
        <div className="loader"></div>
        <h3 className="text-xl font-heading font-semibold mb-2">Generating Your Recipe</h3>
        <p className="text-gray-600 mb-4">
          Our AI is finding the perfect recipe based on your preferences...
        </p>
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Analyzing ingredients</span>
            <span>Validating nutrition</span>
            <span>Finalizing</span>
          </div>
          <p className="text-sm font-medium text-primary pt-2">{getStageMessage()}</p>
        </div>
        {onCancel && (
          <div className="mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="text-gray-600 hover:text-gray-800"
            >
              Cancel Generation
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
