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

const BUNDLE_URL = "https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js";
const PRESET_URL = "https://unpkg.com/swagger-ui-dist/swagger-ui-standalone-preset.js";

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

export default function SwaggerUI({ url }: SwaggerUIProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      await loadScript(BUNDLE_URL);
      await loadScript(PRESET_URL);

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
