import useBlendPlanner from './hooks/useBlendPlanner';
import AppShell from './components/layout/AppShell';

export default function App() {
  const planner = useBlendPlanner();
  return <AppShell {...planner} />;
}
