"use client";

import { useEffect, useRef } from "react";

type SwaggerUIProps = {
  url: string;
};

type SwaggerBundle = {
  presets: {
    apis: unknown;
  };
};

type SwaggerGlobal = {
  SwaggerUIBundle?: ((options: {
    url: string;
    dom_id: string;
    presets: unknown[];
    layout: string;
    plugins?: Array<{
      wrapComponents?: {
        Topbar?: () => null;
      };
    }>;
  }) => void) &
    SwaggerBundle;
  SwaggerUIStandalonePreset?: unknown;
};

const LOCAL_BUNDLE_URL = "/swagger-ui/swagger-ui-bundle.js";
const LOCAL_PRESET_URL = "/swagger-ui/swagger-ui-standalone-preset.js";
const LOCAL_CSS_URL = "/swagger-ui/swagger-ui.css";
const CDN_BUNDLE_URL = "https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js";
const CDN_PRESET_URL =
  "https://unpkg.com/swagger-ui-dist/swagger-ui-standalone-preset.js";
const CDN_CSS_URL = "https://unpkg.com/swagger-ui-dist/swagger-ui.css";

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
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

const loadStylesheet = (href: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load ${href}`));
    document.head.appendChild(link);
  });

const loadWithFallback = async (
  primary: string,
  fallback: string,
  loader: (url: string) => Promise<void>,
) => {
  try {
    await loader(primary);
  } catch {
    await loader(fallback);
  }
};

export default function SwaggerUI({ url }: SwaggerUIProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await loadWithFallback(LOCAL_CSS_URL, CDN_CSS_URL, loadStylesheet);
        await loadWithFallback(LOCAL_BUNDLE_URL, CDN_BUNDLE_URL, loadScript);
        await loadWithFallback(LOCAL_PRESET_URL, CDN_PRESET_URL, loadScript);

        if (cancelled) {
          return;
        }

        const swagger = window as Window & SwaggerGlobal;
        if (!swagger.SwaggerUIBundle) {
          console.error(
            "SwaggerUIBundle is not available after loading scripts.",
          );
          return;
        }

        if (!swagger.SwaggerUIStandalonePreset) {
          console.error(
            "SwaggerUIStandalonePreset is not available after loading scripts.",
          );
          return;
        }

        if (!containerRef.current) {
          console.error("Swagger UI container is not available.");
          return;
        }

        containerRef.current.innerHTML = "";
        swagger.SwaggerUIBundle({
          dom_id: "#swagger-ui",
          layout: "StandaloneLayout",
          presets: [
            swagger.SwaggerUIBundle.presets.apis,
            swagger.SwaggerUIStandalonePreset,
          ],
          url,
          plugins: [
            {
              wrapComponents: {
                Topbar: () => null,
              },
            },
          ],
        });
      } catch (error) {
        console.error("Failed to initialize Swagger UI.", error);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div
      id="swagger-ui"
      ref={containerRef}
      className="swagger-ui min-h-[80vh]"
    />
  );
}
