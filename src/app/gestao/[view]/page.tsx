"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { AppGate } from "@/components/app-gate";
import { isManagementView } from "@/lib/management-routes";

export default function ManagementViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = use(params);

  if (!isManagementView(view) || view === "dashboard") notFound();

  return <AppGate initialView={view} />;
}

