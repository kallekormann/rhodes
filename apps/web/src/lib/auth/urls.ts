import { APP_BASE_PATH } from "@rhodes/shared";

export function appOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/app\/?$/, "") ??
    "http://localhost:3001"
  );
}

export function appUrl(path = "") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${appOrigin()}${APP_BASE_PATH}${normalized}`;
}
