import { RaceDashboard } from "@/components/RaceDashboard";
import { getLiveRaceScored } from "@/lib/liveService";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ raceId: string }> }) {
  const { raceId } = await params;
  const data = await getLiveRaceScored(raceId);
  return <RaceDashboard raceId={raceId} initialData={data} />;
}
