import { EventDirectory } from "@/components/EventDirectory";
import { getEventSummaries } from "@/lib/eventService";

export default async function HomePage() {
  const events = await getEventSummaries();

  return (
    <main className="container">
      <header className="topbar home-topbar">
        <div>
          <h1 className="title">Ski Race Live Scoring</h1>
          <p className="meta home-subtitle">
            Mobile-first race dashboard with real-time team scoring
          </p>
        </div>
      </header>

      <section className="home-layout">
        <EventDirectory events={events} />
      </section>
    </main>
  );
}
