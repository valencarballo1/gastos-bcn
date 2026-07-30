"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ActivityPage } from "@/features/activity/ActivityPage";
import { BalancesPage } from "@/features/balances/BalancesPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ExpensesPage } from "@/features/expenses/ExpensesPage";
import { MembersPage } from "@/features/members/MembersPage";
import { RecurringPage } from "@/features/recurring/RecurringPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ShoppingPage } from "@/features/shopping/ShoppingPage";
import { TasksPage } from "@/features/tasks/TasksPage";
import { useHousehold } from "@/hooks/useHousehold";
import type { ViewKey } from "@/types";

const validViews: ViewKey[] = [
  "dashboard",
  "expenses",
  "recurring",
  "balances",
  "shopping",
  "tasks",
  "calendar",
  "activity",
  "reports",
  "members",
  "settings",
];

export function HomeApp() {
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const { data, balances, suggestedTransfers, actions } = useHousehold();

  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "") as ViewKey;
    if (validViews.includes(fromHash)) setActiveView(fromHash);
  }, []);

  const navigate = (view: ViewKey) => {
    setActiveView(view);
    window.history.replaceState(null, "", `#${view}`);
  };

  return (
    <AppShell
      activeView={activeView}
      onNavigate={navigate}
      household={data.household}
      members={data.members}
    >
      {activeView === "dashboard" && (
        <DashboardPage
          data={data}
          suggestedTransfers={suggestedTransfers}
          onNavigate={navigate}
        />
      )}
      {activeView === "expenses" && (
        <ExpensesPage data={data} addExpense={actions.addExpense} />
      )}
      {activeView === "recurring" && (
        <RecurringPage
          data={data}
          addRecurringExpense={actions.addRecurringExpense}
          toggleRecurringStatus={actions.toggleRecurringStatus}
        />
      )}
      {activeView === "balances" && (
        <BalancesPage
          data={data}
          balances={balances}
          suggestedTransfers={suggestedTransfers}
          addSettlement={actions.addSettlement}
        />
      )}
      {activeView === "shopping" && (
        <ShoppingPage
          data={data}
          addShoppingItem={actions.addShoppingItem}
          toggleShoppingItem={actions.toggleShoppingItem}
          removeShoppingItem={actions.removeShoppingItem}
          finalizeShopping={actions.finalizeShopping}
        />
      )}
      {activeView === "tasks" && (
        <TasksPage
          data={data}
          addTask={actions.addTask}
          setTaskStatus={actions.setTaskStatus}
          toggleChecklist={actions.toggleChecklist}
        />
      )}
      {activeView === "calendar" && <CalendarPage data={data} />}
      {activeView === "activity" && <ActivityPage data={data} />}
      {activeView === "reports" && (
        <ReportsPage data={data} balances={balances} />
      )}
      {activeView === "members" && (
        <MembersPage
          data={data}
          addMember={actions.addMember}
          toggleMemberStatus={actions.toggleMemberStatus}
        />
      )}
      {activeView === "settings" && (
        <SettingsPage data={data} resetDemo={actions.resetDemo} />
      )}
    </AppShell>
  );
}
