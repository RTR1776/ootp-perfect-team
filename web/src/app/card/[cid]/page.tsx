import { CardDetail } from "@/components/card-detail";

export default async function CardPage({
  params,
}: {
  params: Promise<{ cid: string }>;
}) {
  const { cid } = await params;
  return <CardDetail cid={Number(cid)} />;
}
