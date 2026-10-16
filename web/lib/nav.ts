import type { AppRole } from "./roles";
import type { NavItem } from "@/components/AppNav";

// Navigation is a convenience only. Every page and route enforces its own role check.
export const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  creator: [
    { href: "/creator", label: "My project" },
    { href: "/explorer", label: "Explorer" },
  ],
  investor: [
    { href: "/investor", label: "Marketplace" },
    { href: "/explorer", label: "Explorer" },
  ],
  mule: [
    { href: "/mule", label: "Dashboard" },
    { href: "/explorer", label: "Explorer" },
  ],
  organizer: [
    { href: "/organizer", label: "Overview" },
    { href: "/organizer/participants", label: "Participants" },
    { href: "/organizer/scenario", label: "Scenario" },
    { href: "/explorer", label: "Explorer" },
  ],
};
