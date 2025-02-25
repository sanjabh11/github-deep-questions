import React, { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, XCircle, AlertTriangle, Lightbulb, RotateCcw, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export interface ReviewItem {
  title: string;
  description: string;
  severity?: "critical" | "warning" | "suggestion";
}

export interface ArchitectReviewData {
  criticalIssues?: ReviewItem[];
  potentialProblems?: ReviewItem[];
  improvements?: ReviewItem[];
  verdict?: string;
  version?: string;
  timestamp?: number;
  previousVersions?: string[];
}

interface ArchitectReviewProps {
  review: ArchitectReviewData;
  isLoading?: boolean;
  error?: string | null;
  onApplyImprovement?: (improvement: ReviewItem) => void;
  onRevertToPreviousVersion?: (version: string) => void;
}

export function ArchitectReview({
  review,
  isLoading = false,
  error = null,
  onApplyImprovement,
  onRevertToPreviousVersion,
}: ArchitectReviewProps) {
  const [selectedTab, setSelectedTab] = useState("issues");
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-8 w-48" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-full" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mt-2" />
          <Skeleton className="h-4 w-full mt-2" />
          <Skeleton className="h-4 w-full mt-2" />
        </CardContent>
      </Card>
    );
  }

  const hasCriticalIssues = review.criticalIssues && review.criticalIssues.length > 0;
  const hasProblems = review.potentialProblems && review.potentialProblems.length > 0;
  const hasImprovements = review.improvements && review.improvements.length > 0;
  const hasPreviousVersions = review.previousVersions && review.previousVersions.length > 0;

  const issuesCount = (review.criticalIssues?.length || 0) + (review.potentialProblems?.length || 0);
  const improvementsCount = review.improvements?.length || 0;

  // Helper function to determine icon based on severity
  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case "suggestion":
        return <Lightbulb className="h-5 w-5 text-primary" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  // Helper function to render review items
  const renderReviewItems = (items: ReviewItem[] | undefined, canApply = false) => {
    if (!items || items.length === 0) {
      return <p className="text-muted-foreground">None found</p>;
    }

    return (
      <Accordion type="single" collapsible className="w-full">
        {items.map((item, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="flex items-center">
              <div className="flex items-center gap-2">
                {getSeverityIcon(item.severity)}
                <span>{item.title}</span>
                {item.severity && (
                  <Badge variant={
                    item.severity === "critical" ? "destructive" : 
                    item.severity === "warning" ? "outline" : "secondary"
                  }>
                    {item.severity}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="ml-7">
                <p className="text-sm">{item.description}</p>
                {canApply && onApplyImprovement && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => onApplyImprovement(item)}
                  >
                    Apply this improvement
                  </Button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-primary">Architect Review</CardTitle>
          {review.version && (
            <Badge variant="outline" className="ml-2">
              Version {review.version}
            </Badge>
          )}
        </div>
        <CardDescription>
          {review.verdict || "Architecture and design assessment"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="mb-2">
            <TabsTrigger value="issues" className="flex items-center gap-1">
              Issues
              {issuesCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {issuesCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="improvements" className="flex items-center gap-1">
              Improvements
              {improvementsCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {improvementsCount}
                </Badge>
              )}
            </TabsTrigger>
            {hasPreviousVersions && (
              <TabsTrigger value="history">
                History
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="issues">
            {hasCriticalIssues && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 text-destructive">Critical Issues</h4>
                {renderReviewItems(review.criticalIssues)}
              </div>
            )}
            
            {hasProblems && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-amber-500">Potential Problems</h4>
                {renderReviewItems(review.potentialProblems)}
              </div>
            )}
            
            {!hasCriticalIssues && !hasProblems && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-600">No issues found</AlertTitle>
                <AlertDescription className="text-green-600">
                  The architect review did not identify any issues with your solution.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="improvements">
            <h4 className="text-sm font-medium mb-2 text-primary">Suggested Improvements</h4>
            {renderReviewItems(review.improvements, true)}
          </TabsContent>
          
          {hasPreviousVersions && (
            <TabsContent value="history">
              <div>
                <h4 className="text-sm font-medium mb-2">Version History</h4>
                {review.previousVersions && review.previousVersions.length > 0 ? (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentVersionIndex <= 0}
                        onClick={() => setCurrentVersionIndex(prev => Math.max(0, prev - 1))}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" /> Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {currentVersionIndex + 1} of {review.previousVersions.length + 1}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentVersionIndex >= review.previousVersions.length}
                        onClick={() => setCurrentVersionIndex(prev => Math.min(review.previousVersions!.length, prev + 1))}
                      >
                        Next <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                    
                    {currentVersionIndex > 0 && onRevertToPreviousVersion && (
                      <Button 
                        variant="outline" 
                        className="mb-2 w-full"
                        onClick={() => onRevertToPreviousVersion(review.previousVersions![currentVersionIndex - 1])}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" /> 
                        Revert to Version {review.previousVersions[currentVersionIndex - 1]}
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No previous versions available</p>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}