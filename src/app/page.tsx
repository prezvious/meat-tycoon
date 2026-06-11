import { loadGameModel } from '@/lib/game/model';
import { GameDashboard } from '@/components/GameDashboard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const model = await loadGameModel();
  return <GameDashboard model={model} />;
}

