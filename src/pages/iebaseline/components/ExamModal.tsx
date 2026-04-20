import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { X, CheckCircle2, XCircle, ArrowRight, Box, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOCK_QUESTIONS = [
  {
    id: 'q1',
    text: "Which of the following is considered the most critical control point in the baseline PCF flow?",
    options: [
      { id: 'opt1', text: "Pre-assembly inspection gate" },
      { id: 'opt2', text: "Final automated optical inspection (AOI)" },
      { id: 'opt3', text: "The initial material staging area" },
      { id: 'opt4', text: "Post-soldering thermal test" },
    ],
    correctId: 'opt2',
    explanation: "Final AOI captures the highest percentage of critical defects before the product leaves the controlled zone, making it the primary control point in PCF."
  },
  {
    id: 'q2',
    text: "Review the production flow diagram below. Which stage represents the bottleneck if Cycle Time A is 12s, B is 18s, and C is 10s?",
    visual: (
      <div className="w-full bg-white/5 rounded-2xl border border-white/10 p-6 sm:p-10 flex flex-col items-center justify-center mt-4 shadow-xl">
        <div className="flex items-center gap-2 sm:gap-6 text-white w-full justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-500/20 border-2 border-blue-500/50 flex items-center justify-center shadow-inner">
              <Box className="w-8 h-8 text-blue-400" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-white/70">Stage A (12s)</span>
          </div>
          <ArrowRight className="w-6 h-6 sm:w-8 sm:h-8 text-white/30" />
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center shadow-inner ring-4 ring-red-500/20">
              <Layers className="w-8 h-8 text-red-400" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-red-400">Stage B (18s)</span>
          </div>
          <ArrowRight className="w-6 h-6 sm:w-8 sm:h-8 text-white/30" />
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center shadow-inner">
              <Box className="w-8 h-8 text-emerald-400" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-white/70">Stage C (10s)</span>
          </div>
        </div>
      </div>
    ),
    options: [
      { id: 'opt1', text: "Stage A" },
      { id: 'opt2', text: "Stage B" },
      { id: 'opt3', text: "Stage C" },
      { id: 'opt4', text: "Both A and C" },
    ],
    correctId: 'opt2',
    explanation: "The bottleneck is always the stage with the longest cycle time, as it dictates the maximum throughput of the entire line. Stage B takes 18s."
  },
  {
    id: 'q3',
    text: "In the context of the 8 Wastes of Lean, which waste does 'overprocessing' refer to?",
    options: [
      { id: 'opt1', text: "Producing more items than customer demand" },
      { id: 'opt2', text: "Unnecessary movement of materials between stations" },
      { id: 'opt3', text: "Adding features or performing steps that do not add value for the customer" },
      { id: 'opt4', text: "Idle time of workers waiting for machines" },
    ],
    correctId: 'opt3',
    explanation: "Overprocessing occurs when more work is done on a piece than what is required by the customer, such as polishing a surface that will be hidden."
  },
  {
    id: 'q4',
    text: "What does Overall Labor Efficiency (OLE) primarily measure in a manufacturing setup?",
    options: [
      { id: 'opt1', text: "The percentage of time machines are actively running" },
      { id: 'opt2', text: "The ratio of productive labor hours to total available labor hours" },
      { id: 'opt3', text: "The total energy consumption of the workforce" },
      { id: 'opt4', text: "The raw material yield over a specific shift" },
    ],
    correctId: 'opt2',
    explanation: "OLE focuses specifically on the human element, measuring how effectively available labor hours are converted into productive value."
  },
  {
    id: 'q5',
    text: "Which action is most appropriate when an operator repeatedly fails to meet the takt time at a specific workstation?",
    options: [
      { id: 'opt1', text: "Immediately replace the operator" },
      { id: 'opt2', text: "Increase the conveyor speed to force compliance" },
      { id: 'opt3', text: "Conduct a time and motion study to identify specific micro-bottlenecks or ergonomic issues" },
      { id: 'opt4', text: "Ignore the issue if the daily quota is met through overtime" },
    ],
    correctId: 'opt3',
    explanation: "A time and motion study objectively identifies physical constraints, poor layout, or lack of training without unfairly penalizing the operator."
  }
];

interface ExamModalProps {
  onClose: () => void;
}

export default function ExamModal({ onClose }: ExamModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const question = MOCK_QUESTIONS[currentIndex];
  const isCorrect = isSubmitted && selectedOption === question.correctId;

  const handleSubmit = () => {
    setIsSubmitted(true);
  };

  const handleNext = () => {
    if (currentIndex < MOCK_QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption('');
      setIsSubmitted(false);
    } else {
      // Finished
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex bg-black/95 backdrop-blur-md animate-in fade-in duration-300 overflow-hidden">
      {/* Top Actions */}
      <div className="absolute top-4 right-4 lg:top-6 lg:right-6 z-[110]">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/20 rounded-full">
          <X className="w-6 h-6" />
        </Button>
      </div>

      <div className="w-full h-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 p-6 pt-20 lg:p-12 lg:pt-24 gap-8 lg:gap-16">
        
        {/* Left Column: Question Area */}
        <div className="flex flex-col h-full overflow-y-auto pb-8 pr-2 lg:pr-4">
           <div className="space-y-6 lg:space-y-8 animate-in slide-in-from-left-4 duration-500 my-auto">
             <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-sm font-semibold tracking-wider uppercase">
               Question {currentIndex + 1} of {MOCK_QUESTIONS.length}
             </div>
             <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
               {question.text}
             </h2>
             {/* Dynamic Rich Media / Visual Component */}
             {question.visual && (
               <div className="w-full animate-in fade-in zoom-in-95 duration-500 delay-150 fill-mode-both">
                 {question.visual}
               </div>
             )}
           </div>
        </div>

        {/* Right Column: Answer Card */}
        <div className="flex flex-col h-full overflow-y-auto pb-8 lg:px-4">
          <Card className="bg-background/95 backdrop-blur-md border-border/50 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] p-2 sm:p-4 animate-in slide-in-from-right-8 duration-500 relative overflow-hidden rounded-2xl w-full h-fit my-auto">
            
            {/* Instant Feedback Overlay inside the Card */}
            {isSubmitted && (
              <div className={cn(
                "absolute inset-x-0 top-0 p-5 sm:p-6 flex items-start gap-4 border-b animate-in slide-in-from-top-2 duration-300", 
                isCorrect ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
              )}>
                {isCorrect ? (
                   <CheckCircle2 className="w-7 h-7 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                   <XCircle className="w-7 h-7 text-red-500 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1.5">
                   <h4 className={cn("text-lg font-bold", isCorrect ? "text-emerald-500" : "text-red-500")}>
                     {isCorrect ? "Correct!" : "Incorrect"}
                   </h4>
                   {!isCorrect && (
                     <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                       {question.explanation}
                     </p>
                   )}
                </div>
              </div>
            )}

            <div className={cn("space-y-6 p-4 sm:p-6 transition-all duration-300", isSubmitted && !isCorrect ? "pt-32 sm:pt-36" : isSubmitted && isCorrect ? "pt-24 sm:pt-28" : "")}>
              <RadioGroup value={selectedOption} onValueChange={setSelectedOption} disabled={isSubmitted} className="grid gap-3">
                 {question.options.map(opt => {
                    const isSelected = selectedOption === opt.id;
                    const isCorrectOption = opt.id === question.correctId;
                    
                    let optionClasses = "flex items-center space-x-4 p-5 rounded-xl border-2 transition-all cursor-pointer select-none group";
                    
                    if (!isSubmitted) {
                       optionClasses += isSelected 
                          ? " border-primary bg-primary/5" 
                          : " border-border hover:border-primary/50 bg-background/50 hover:bg-muted/50";
                    } else {
                       if (isCorrectOption) {
                          optionClasses += " border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20";
                       } else if (isSelected && !isCorrectOption) {
                          optionClasses += " border-red-500 bg-red-500/10 ring-2 ring-red-500/20";
                       } else {
                          optionClasses += " border-border/30 bg-background/30 opacity-40 cursor-not-allowed";
                       }
                    }

                    return (
                      <label key={opt.id} className={optionClasses}>
                        {!isSubmitted && (
                          <RadioGroupItem value={opt.id} id={opt.id} className="mt-0.5 data-[state=checked]:border-primary" />
                        )}
                        {isSubmitted && isCorrectOption && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                        {isSubmitted && isSelected && !isCorrectOption && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                        
                        <span className={cn(
                          "flex-1 text-base sm:text-lg font-medium leading-tight", 
                          !isSubmitted && isSelected ? "text-foreground" : !isSubmitted ? "text-foreground/80 group-hover:text-foreground" : "text-foreground"
                        )}>
                          {opt.text}
                        </span>
                      </label>
                    )
                 })}
              </RadioGroup>

              <div className="pt-2 flex justify-end">
                {!isSubmitted ? (
                   <Button size="lg" className="w-full sm:w-auto px-12 h-14 text-lg font-semibold shadow-xl" disabled={!selectedOption} onClick={handleSubmit}>
                     Submit Answer
                   </Button>
                ) : (
                   <Button size="lg" className={cn(
                      "w-full sm:w-auto px-12 h-14 text-lg font-semibold shadow-xl", 
                      isCorrect ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                   )} onClick={handleNext}>
                     {currentIndex < MOCK_QUESTIONS.length - 1 ? 'Next Question' : 'Finish Exam'}
                   </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
