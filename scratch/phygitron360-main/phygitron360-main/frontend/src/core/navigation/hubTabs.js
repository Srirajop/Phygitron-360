import { MODULE_CONFIG } from "../config/modules";

export const canViewDashboardTab = (hasRole) =>
  hasRole?.(["org_admin", "super_admin"]) === true;

export const getHubTabs = ({ hasPermission, hasRole }) => {
  const moduleTabs = Object.entries(MODULE_CONFIG)
    .filter(([_, config]) => hasPermission?.(config.permission))
    .map(([key, config]) => ({
      id: key,
      name: config.label,
      path: config.route,
    }));

  if (!canViewDashboardTab(hasRole)) {
    return moduleTabs;
  }

  return [
    {
      id: "dashboard",
      name: "Dashboard",
      path: "/admin",
    },
    ...moduleTabs,
  ];
};
