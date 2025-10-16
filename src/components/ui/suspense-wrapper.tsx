"use client"

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Skeleton } from "./loading-skeleton";

interface SuspenseWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ComponentType<any>;
}

function DefaultErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="p-6 text-center">
      <h2 className="text-lg font-semibold text-red-600 mb-2">Something went wrong</h2>
      <p className="text-gray-600 mb-4">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80"
      >
        Try again
      </button>
    </div>
  );
}

function DefaultSuspenseFallback() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function SuspenseWrapper({
  children,
  fallback,
  errorFallback: ErrorFallback = DefaultErrorFallback
}: SuspenseWrapperProps) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={fallback || <DefaultSuspenseFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}