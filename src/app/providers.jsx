"use client";

import { useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserContextProvider } from "@/context/user";
import { WindowResizeProvider } from "@/context/windowResize";
import { WindowVisibilityProvider } from "@/context/windowVisibility";
import { LastShownProvider } from "@/context/lastShownDates";
import { HiVizContextProvider } from "@/context/hiViz";

const Providers = ({ children }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 60 * 1000,
          },
        },
      })
  );

  return (
    <WindowVisibilityProvider>
      <WindowResizeProvider>
        <HiVizContextProvider>
          <QueryClientProvider client={queryClient}>
            <UserContextProvider>
              <LastShownProvider>{children}</LastShownProvider>
            </UserContextProvider>
          </QueryClientProvider>
        </HiVizContextProvider>
      </WindowResizeProvider>
    </WindowVisibilityProvider>
  );
};

export default Providers;
