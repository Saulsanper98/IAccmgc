import type { Metadata } from "next";

import { auth } from "@/auth";

import { getRunbook } from "@/lib/api";

import { RunbookExecutor } from "@/components/runbooks/RunbookExecutor";

import { notFound, redirect } from "next/navigation";



function dedupeVariables(

  items: { name: string; description: string; default: string }[],

) {

  const seen = new Set<string>();

  return items.filter((item) => {

    if (seen.has(item.name)) return false;

    seen.add(item.name);

    return true;

  });

}



export async function generateMetadata({

  params,

}: {

  params: Promise<{ id: string }>;

}): Promise<Metadata> {

  return { title: "Ejecutar runbook" };

}



export default async function RunbookExecutePage({

  params,

}: {

  params: Promise<{ id: string }>;

}) {

  const session = await auth();

  if (!session) redirect("/login");



  const { id } = await params;

  let runbook = null;

  try {

    runbook = await getRunbook(session, id);

  } catch {

    notFound();

  }



  if (runbook.status !== "published") {

    redirect(`/runbooks/${id}`);

  }



  const variables = dedupeVariables(

    runbook.steps.flatMap(

      (s: { variables: { name: string; description: string; default: string }[] }) => s.variables,

    ),

  );



  return (

    <RunbookExecutor

      runbookId={id}

      runbookTitle={runbook.title}

      runbookVersion={runbook.version}

      steps={runbook.steps}

      variables={variables}

    />

  );

}

