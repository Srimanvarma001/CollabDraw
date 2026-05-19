import { DrawingCanvas } from "./DrawingCanvas";

export default async function RoomPage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;
  return <DrawingCanvas roomId={slug} />;
}