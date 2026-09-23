"use client";

import { use, useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import { AppGate } from "@/components/app-gate";
import { isManagementView, type ManagementView } from "@/lib/management-routes";

export default function ManagementViewPage({
  params,
}: {
  params?: Promise<{ view: string }> | { view: string };
}) {
  const urlParams = useParams<{ view: string }>();

  let view: string | undefined =
    typeof urlParams?.view === "string"
      ? urlParams.view
      : Array.isArray(urlParams?.view)
      ? urlParams.view[0]
      : undefined;

  if (!view && params) {
    if (typeof (params as any)?.then === "function") {
      try {
        const unwrapped = use(params as Promise<{ view: string }>);
        view = unwrapped?.view;
      } catch {
        // ignore
      }
    } else if ((params as { view: string })?.view) {
      view = (params as { view: string }).view;
    }
  }

  if (!view || !isManagementView(view) || view === "dashboard") {
    notFound();
  }

  return <AppGate initialView={view as ManagementView} />;
}


