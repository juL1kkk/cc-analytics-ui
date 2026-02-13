export type UiSource = "API" | "MOCK";

export function getUiSource(): UiSource | null {
  if (typeof window === "undefined") return null;

  const sp = new URLSearchParams(window.location.search);

  const fromUrl = sp.get("src");
  if (fromUrl === "api") return "API";
  if (fromUrl === "mock") return "MOCK";

  const fromLs = window.localStorage.getItem("uiSource");
  if (fromLs === "API" || fromLs === "MOCK") return fromLs;

  return null;
}
