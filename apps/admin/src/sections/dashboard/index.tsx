import Statistics from "./components/statistics";
import "./dashboard.css";

export default function Dashboard() {
  return (
    <div className="dashboard-page mx-auto flex w-full max-w-[1680px] flex-1 flex-col pb-8">
      <Statistics />
    </div>
  );
}
