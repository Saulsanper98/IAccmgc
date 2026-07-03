import type { Metadata } from "next";

import { auth } from "@/auth";

import { getRunbook } from "@/lib/api";

import { RunbookEditor } from "@/components/runbooks/RunbookEditor";

import { Breadcrumb } from "@/components/ui/Breadcrumb";

import { notFound } from "next/navigation";



export const metadata: Metadata = { title: "Runbook" };



export default async function RunbookDetailPage({

  params,

}: {

  params: Promise<{ id: string }>;

}) {

  const session = await auth();

  if (!session) return null;



  const { id } = await params;

  let runbook = null;

  try {

    runbook = await getRunbook(session, id);

  } catch {

    notFound();

  }



  const canEdit = ["admin", "editor"].includes(session.user.role);



  return (

    <div>

      <Breadcrumb

        items={[

          { label: "Runbooks", href: "/runbooks" },

          { label: runbook.title },

        ]}

        className="mb-4"

      />

      <RunbookEditor runbook={runbook} canEdit={canEdit} />

    </div>

  );

}

