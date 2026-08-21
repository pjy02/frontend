import Billing from "./components/billing";
import Statistics from "./components/statistics";
import "./dashboard.css";

export default function Dashboard() {
  return (
    <div className="dashboard-page mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 pb-8">
      <Statistics />
      <Billing type="dashboard" />
    </div>
  );
}
