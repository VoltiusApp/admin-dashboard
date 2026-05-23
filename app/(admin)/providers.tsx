"use client";

import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState, Suspense } from "react";
import { CommandPalette } from "./CommandPalette";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => getQueryClient());
  return (
    <QueryClientProvider client={client}>
      {children}
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0a0a0a",
            border: "1px solid #262626",
            color: "#e5e5e5",
            fontFamily:
              "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
            fontSize: "13px",
          },
        }}
      />
    </QueryClientProvider>
  );
}
