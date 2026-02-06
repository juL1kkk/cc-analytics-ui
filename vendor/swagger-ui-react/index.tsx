"use client";

import { useEffect, useRef } from "react";

type SwaggerUIProps = {
  url: string;
};

type SwaggerGlobal = {
  SwaggerUIBundle?: (options: {
    url: string;
    domNode: HTMLElement;
    presets?: unknown[];
    layout?: string;
  }) => void;
  SwaggerUIStandalonePreset?: unknown;
};

const BUNDLE_URLS = [
  "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
  "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js",
];
const PRESET_URLS = [
  "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js",
  "https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js",
];

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src=\"${src}\"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });

const loadFirstAvailable = async (sources: string[]) => {
  let lastError: Error | null = null;
  for (const src of sources) {
    try {
      await loadScript(src);
      return;
    } catch (error) {
      lastError = error as Error;
    }
  }
  throw lastError ?? new Error("Failed to load Swagger UI assets");
};

export default function SwaggerUI({ url }: SwaggerUIProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await loadFirstAvailable(BUNDLE_URLS);
        await loadFirstAvailable(PRESET_URLS);
      } catch (error) {
        if (containerRef.current) {
          containerRef.current.textContent =
            "Не удалось загрузить Swagger UI. Проверьте доступность CDN.";
        }
        return;
      }

      if (cancelled) {
        return;
      }

      const swagger = window as Window & SwaggerGlobal;
      if (!swagger.SwaggerUIBundle || !containerRef.current) {
        return;
      }

      containerRef.current.innerHTML = "";
      swagger.SwaggerUIBundle({
        url,
        domNode: containerRef.current,
        presets: swagger.SwaggerUIStandalonePreset
          ? [swagger.SwaggerUIStandalonePreset]
          : undefined,
        layout: "BaseLayout",
      });
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return <div ref={containerRef} className="swagger-ui" />;
}
