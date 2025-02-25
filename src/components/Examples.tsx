import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";

interface Example {
  title: string;
  description: string;
  code?: string;
  explanation?: string;
}

interface ExamplesProps {
  examples: Example[];
  isLoading: boolean;
  error?: string;
  className?: string;
}

export function Examples({
  examples,
  isLoading,
  error,
  className = ''
}: ExamplesProps) {
  const [activeTab, setActiveTab] = useState<string>('0');

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <ExclamationTriangleIcon className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-primary font-medium">🧩 Generating examples...</div>
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-1/3" />
              </CardHeader>
              <CardContent className="pb-2">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-24 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!examples || examples.length === 0) {
    return (
      <div className="text-muted-foreground text-sm p-4">
        No examples available at this time.
      </div>
    );
  }

  // If there's only one example, show it directly without tabs
  if (examples.length === 1) {
    const example = examples[0];
    return (
      <div className={className}>
        <div className="text-primary font-medium mb-4">🧩 Example:</div>
        <Card>
          <CardHeader>
            <CardTitle>{example.title}</CardTitle>
            <CardDescription>{example.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {example.code && (
              <pre className="p-4 bg-muted rounded-md overflow-x-auto">
                <code>{example.code}</code>
              </pre>
            )}
            <div className="mt-4">
              {example.explanation || example.description}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="text-primary font-medium mb-4">🧩 Examples:</div>
      <Tabs defaultValue="0" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 mb-4">
          {examples.map((example, index) => (
            <TabsTrigger key={index} value={String(index)} className="truncate">
              {example.title}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {examples.map((example, index) => (
          <TabsContent key={index} value={String(index)} className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>{example.title}</CardTitle>
                <CardDescription>{example.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {example.code && (
                  <pre className="p-4 bg-muted rounded-md overflow-x-auto">
                    <code>{example.code}</code>
                  </pre>
                )}
                <div className="mt-4 prose dark:prose-invert">
                  {example.explanation || example.description}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
} 