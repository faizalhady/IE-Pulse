import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MODULES } from './IEBaseline';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, CheckCircle2, Clock, PlayCircle, ChevronLeft, Calendar, FileText, BookOpen } from 'lucide-react';
import ExamModal from './components/ExamModal';

export default function ModuleOverview() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const module = MODULES.find(m => m.id === moduleId);
  const [activeExam, setActiveExam] = useState<string | null>(null);

  if (!module) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Module Not Found</h2>
        <Button asChild><Link to="/iebaseline">Return to Dashboard</Link></Button>
      </div>
    );
  }

  const isCompleted = module.status === 'Completed';
  const totalDuration = module.lessons.reduce((acc, curr) => {
    // Very simplified mock duration parser assuming "X mins"
    const mins = parseInt(curr.duration.split(' ')[0]) || 0;
    return acc + mins;
  }, 0);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Breadcrumb / Back Navigation */}
      <div className="flex items-center">
        <Button variant="ghost" size="sm" asChild className="gap-2 -ml-3 text-muted-foreground hover:text-foreground">
          <Link to="/iebaseline">
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Column (Span 2) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Results Banner (Conditionally Rendered) */}
          {isCompleted && (
            <Card className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-background border-emerald-500/30 overflow-hidden relative">
              <div className="absolute -right-6 -top-6 text-emerald-500/10 pointer-events-none">
                <Trophy className="w-32 h-32" />
              </div>
              <div className="p-6 flex items-center gap-6 relative z-10">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  <Trophy className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-foreground">Module Completed!</h3>
                  <p className="text-sm text-muted-foreground">You passed the final assessment with a score of <span className="text-emerald-500 font-bold">90%</span>. Excellent work.</p>
                </div>
              </div>
            </Card>
          )}

          {/* Title & Description */}
          <div className="space-y-4">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              {module.status}
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{module.name}</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {module.description}
            </p>
          </div>

          {/* Tabs Section */}
          <Tabs defaultValue="lessons" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/50 border border-border/50">
              <TabsTrigger value="lessons">Lessons in this Course</TabsTrigger>
              <TabsTrigger value="details">Additional Details</TabsTrigger>
            </TabsList>
            
            <TabsContent value="lessons" className="pt-6">
              <div className="space-y-3">
                {module.lessons.map((lesson, idx) => (
                  <div key={lesson.id} className="group flex items-center justify-between p-4 rounded-xl bg-background/50 border border-border/50 hover:border-primary/30 hover:shadow-sm transition-all duration-200">
                    <div className="flex items-center gap-4">
                      {lesson.completed ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border shrink-0">
                          <span className="text-xs font-semibold text-muted-foreground">{idx + 1}</span>
                        </div>
                      )}
                      <div>
                        <h4 className={`font-medium ${lesson.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {lesson.title}
                        </h4>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3.5 h-3.5" />
                          {lesson.duration}
                        </span>
                      </div>
                    </div>
                    {!lesson.completed && (
                      <Button variant="ghost" size="icon" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10 hover:text-primary" onClick={() => setActiveExam(lesson.id)}>
                        <PlayCircle className="w-6 h-6" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="details" className="pt-6">
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                <p>This module provides foundational knowledge required for modern industrial engineering practices. Upon completion, you will be equipped to identify bottlenecks, perform basic yield analysis, and participate in continuous improvement initiatives.</p>
                <p><strong>Prerequisites:</strong> None</p>
                <p><strong>Certification:</strong> Yes, a digital badge is awarded upon passing the final assessment.</p>
              </div>
            </TabsContent>
          </Tabs>

        </div>

        {/* Action Card Column (Span 1) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            <Card className="overflow-hidden border-border/50 bg-background/60 backdrop-blur-md shadow-lg shadow-black/5">
              {/* Abstract Cover Graphic */}
              <div className="h-32 w-full bg-gradient-to-br from-primary/20 via-blue-500/10 to-emerald-500/20 relative overflow-hidden flex items-center justify-center border-b border-border/50">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
                <BookOpen className="w-12 h-12 text-primary/40 relative z-10 drop-shadow-sm" />
              </div>
              
              <div className="p-6 space-y-6">
                <Button className="w-full h-12 text-md font-semibold gap-2 shadow-sm" size="lg" onClick={() => setActiveExam('course-start')}>
                  {isCompleted ? 'Review Course Material' : 'Start Course'}
                  <PlayCircle className="w-5 h-5" />
                </Button>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground"><Clock className="w-4 h-4" /> Total Duration</span>
                    <span className="font-medium text-foreground">~{totalDuration} mins</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground"><FileText className="w-4 h-4" /> Lessons</span>
                    <span className="font-medium text-foreground">{module.lessons.length} Modules</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" /> Delivery</span>
                    <span className="font-medium text-foreground">Self-Directed</span>
                  </div>
                </div>

                <hr className="border-border/50" />

                <div className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Instructor / Contact</span>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-primary/10 text-primary">JD</AvatarFallback>
                    </Avatar>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">John Doe</p>
                      <p className="text-xs text-muted-foreground">Senior Training Engineer</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Exam Overlay Modal */}
      {activeExam && <ExamModal onClose={() => setActiveExam(null)} />}
    </div>
  );
}
