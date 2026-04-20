import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MODULES } from './IEBaseline';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ChevronLeft, Save, UploadCloud, Plus, Trash2, FileText, Image as ImageIcon } from 'lucide-react';

export default function ModuleAdmin() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const module = MODULES.find(m => m.id === moduleId);
  const [activeSection, setActiveSection] = useState('general');

  // Robust scroll spy using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );

    const sections = ['general', 'instructor', 'visuals', 'syllabus', 'quiz', 'media'];
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  if (!module) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Module Not Found</h2>
        <Button asChild><Link to="/iebaseline">Return to Dashboard</Link></Button>
      </div>
    );
  }

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navItems = [
    { id: 'general', label: 'General & Metadata' },
    { id: 'instructor', label: 'Instructor Profile' },
    { id: 'visuals', label: 'Visual Customization' },
    { id: 'syllabus', label: 'Syllabus Context' },
    { id: 'quiz', label: 'Quiz Builder' },
    { id: 'media', label: 'Context Media' },
  ];

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto pb-32">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 -mx-6 px-6 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-muted-foreground hover:text-foreground" asChild>
            <Link to="/iebaseline/edit">
              <ChevronLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">Edit Module</h1>
            <p className="text-xs text-muted-foreground">{module.name}</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 px-4 h-8">
          <Save className="w-3.5 h-3.5" />
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 mt-6">
        
        {/* Main Content Area */}
        <div className="lg:col-span-4 space-y-16">
          
          {/* Section 1: General */}
          <section id="general" className="scroll-mt-32">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">General & Metadata</h2>
              <p className="text-muted-foreground">Configure the core details displayed on the dashboard.</p>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                 <div>
                   <Label className="text-base">Published Status</Label>
                   <p className="text-sm text-muted-foreground mt-1">Make this module visible to engineers.</p>
                 </div>
                 <Switch defaultChecked />
              </div>
              
              <div className="space-y-3">
                <Label>Module Title</Label>
                <Input defaultValue={module.name} className="bg-background/50" />
              </div>
              <div className="space-y-3">
                <Label>Short Description</Label>
                <Textarea defaultValue={module.description} className="bg-background/50 min-h-[100px]" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label>Estimated Time</Label>
                  <Input defaultValue="40 mins" className="bg-background/50" />
                </div>
                <div className="space-y-3">
                  <Label>Number of Lessons</Label>
                  <Input defaultValue={`${module.lessons.length} Modules`} className="bg-background/50" />
                </div>
                <div className="space-y-3">
                  <Label>Delivery Mode</Label>
                  <Input defaultValue="Self-Directed" className="bg-background/50" />
                </div>
                <div className="space-y-3">
                  <Label>Certification</Label>
                  <Input defaultValue="Digital Badge Awarded" className="bg-background/50" />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Prerequisites</Label>
                <Textarea defaultValue="None" className="bg-background/50" />
              </div>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Section 2: Instructor */}
          <section id="instructor" className="scroll-mt-32">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Instructor Profile</h2>
              <p className="text-muted-foreground">Details shown on the module overview card.</p>
            </div>
            <Card className="bg-background/40 backdrop-blur-sm border-border/50">
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="col-span-1 space-y-3">
                  <Label>Avatar Photo</Label>
                  <div className="w-full aspect-square rounded-2xl border-2 border-dashed border-border/50 bg-muted/20 flex flex-col items-center justify-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer group">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                       <UploadCloud className="w-8 h-8 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground font-medium">Click to upload</span>
                  </div>
                </div>
                <div className="col-span-2 space-y-6">
                  <div className="space-y-3">
                    <Label>Instructor Name</Label>
                    <Input defaultValue="John Doe" className="bg-background/50" />
                  </div>
                  <div className="space-y-3">
                    <Label>Job Title</Label>
                    <Input defaultValue="Senior Training Engineer" className="bg-background/50" />
                  </div>
                  <div className="space-y-3">
                    <Label>Contact Email</Label>
                    <Input defaultValue="johndoe@company.com" className="bg-background/50" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Separator className="bg-border/50" />

          {/* Section 3: Visuals */}
          <section id="visuals" className="scroll-mt-32">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Visual Customization</h2>
              <p className="text-muted-foreground">Control the aesthetic presentation of the module header.</p>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label>Header Illustration Type</Label>
                  <Select defaultValue="book">
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select an icon..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="book">Book Open (Default)</SelectItem>
                      <SelectItem value="trophy">Trophy</SelectItem>
                      <SelectItem value="microscope">Microscope</SelectItem>
                      <SelectItem value="gears">Gears</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label>Header Background Style</Label>
                  <Select defaultValue="abstract">
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select a style..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="abstract">Abstract Grid Pattern</SelectItem>
                      <SelectItem value="gradient-blue">Linear Gradient (Blue/Emerald)</SelectItem>
                      <SelectItem value="solid-dark">Solid Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-3">
                <Label>Primary CTA Button Text</Label>
                <Input defaultValue="Start Course" className="bg-background/50" />
              </div>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Section 4: Syllabus */}
          <section id="syllabus" className="scroll-mt-32">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Syllabus & Lesson Content</h2>
              <p className="text-muted-foreground">Detailed markdown text used to feed AI context and render the syllabus view.</p>
            </div>
            <Card className="bg-background/40 backdrop-blur-sm border-border/50">
              <CardContent className="p-0">
                <Textarea 
                  placeholder="## Module 1: Introduction..." 
                  className="min-h-[400px] border-0 bg-transparent rounded-none p-6 font-mono text-sm resize-y focus-visible:ring-0" 
                  defaultValue="## Overview&#10;This module covers the core concepts required for identifying efficiency bottlenecks.&#10;&#10;## Objectives&#10;- Understand takt time.&#10;- Identify the 8 wastes.&#10;- Calculate OLE metrics."
                />
              </CardContent>
            </Card>
          </section>

          <Separator className="bg-border/50" />

          {/* Section 5: Quiz Builder */}
          <section id="quiz" className="scroll-mt-32">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Quiz Builder</h2>
              <p className="text-muted-foreground">Manage multiple choice questions and instant feedback explanations.</p>
            </div>
            <div className="space-y-6">
              
              {/* Question Item 1 */}
              <Card className="bg-background/40 backdrop-blur-sm border-border/50 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                <CardHeader className="flex flex-row items-start justify-between pb-4">
                  <CardTitle className="text-lg">Question 1</CardTitle>
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive -mt-2 -mr-2">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label>Question Text</Label>
                    <Textarea defaultValue="Which of the following is considered the most critical control point in the baseline PCF flow?" className="bg-background/50 h-20" />
                  </div>
                  
                  <div className="space-y-4">
                    <Label>Options & Correct Answer</Label>
                    <RadioGroup defaultValue="opt2" className="grid gap-3">
                      {[1, 2, 3, 4].map(num => (
                        <div key={num} className="flex items-center gap-4 bg-background/50 p-2 rounded-lg border border-border/50 focus-within:border-primary/50 transition-colors">
                          <RadioGroupItem value={`opt${num}`} id={`q1-opt${num}`} className="ml-2" />
                          <Input className="border-0 bg-transparent focus-visible:ring-0 px-2" defaultValue={
                            num === 1 ? "Pre-assembly inspection gate" : 
                            num === 2 ? "Final automated optical inspection (AOI)" : 
                            num === 3 ? "The initial material staging area" : "Post-soldering thermal test"
                          } />
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/50">
                    <Label className="text-emerald-500">Explanation of Correct Answer</Label>
                    <Textarea defaultValue="Final AOI captures the highest percentage of critical defects before the product leaves the controlled zone." className="bg-emerald-500/5 border-emerald-500/20 text-sm" />
                  </div>
                </CardContent>
              </Card>

              <Button variant="outline" className="w-full h-14 border-dashed border-2 hover:bg-primary/5 hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors">
                <Plus className="w-5 h-5 mr-2" />
                Add New Question
              </Button>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Section 6: Context Media */}
          <section id="media" className="scroll-mt-32">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Context Media Attachments</h2>
              <p className="text-muted-foreground">Upload reference documents and images for AI context and user downloads.</p>
            </div>
            <Card className="bg-background/40 backdrop-blur-sm border-border/50">
              <CardContent className="p-6 space-y-6">
                <div className="w-full h-48 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-4 hover:bg-primary/10 transition-colors cursor-pointer">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                    <UploadCloud className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-foreground">Drag & drop files here, or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-1">Supports PDF, DOCX, PNG, JPG up to 50MB</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Uploaded Files</h4>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-blue-500/10 text-blue-500">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Syllabus_Outline_v2.pdf</p>
                          <p className="text-xs text-muted-foreground">1.2 MB</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-purple-500/10 text-purple-500">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">flow_diagram_stage_b.png</p>
                          <p className="text-xs text-muted-foreground">845 KB</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

        </div>

        {/* Right Column: Quick Nav */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-32 space-y-6">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Navigation</h4>
            <nav className="flex flex-col gap-1 border-l-2 border-border/50 pl-4 relative">
              {/* Highlight bar could be implemented with absolute positioning and transition, keeping it simple for now */}
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`text-left py-2 text-sm font-medium transition-colors hover:text-primary relative ${activeSection === item.id ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {activeSection === item.id && (
                    <span className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-[2px] h-full bg-primary rounded-r"></span>
                  )}
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

      </div>
    </div>
  );
}
