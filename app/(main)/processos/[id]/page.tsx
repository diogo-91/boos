import { ProcessDetailPage } from "@/components/ProcessDetailPage";

type ProcessPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProcessPage({ params }: ProcessPageProps) {
  const { id } = await params;
  return <ProcessDetailPage processId={id} />;
}
