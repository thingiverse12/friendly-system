import { PlayClient } from "@/components/PlayClient";
export const metadata = { title: "Spelar" };
export default async function Play({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayClient key={id} id={id} />;
}
