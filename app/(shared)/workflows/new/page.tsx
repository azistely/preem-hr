"use client";

import { useSearchParams } from "next/navigation";
import { WorkflowWizard } from "@/components/workflow/workflow-wizard";

export default function NewWorkflowPage() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");

  return <WorkflowWizard initialTemplateId={templateId || undefined} />;
}
