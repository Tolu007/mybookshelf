"use client";

import { useSyncExternalStore } from "react";

function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

const subscribe = () => () => {};

// Uses the reader's own clock, not the server's. The server renders a
// neutral greeting so hydration never mismatches.
export function TimeGreeting() {
  return useSyncExternalStore(subscribe, () => greetingFor(new Date().getHours()), () => "Welcome back");
}
