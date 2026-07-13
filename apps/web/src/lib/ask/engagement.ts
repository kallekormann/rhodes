const ASK_ENGAGED_DATE_KEY = "rhodes-ask-engaged-date";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function hasAskEngagedToday(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ASK_ENGAGED_DATE_KEY) === todayKey();
}

export function markAskEngagedToday(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ASK_ENGAGED_DATE_KEY, todayKey());
}
