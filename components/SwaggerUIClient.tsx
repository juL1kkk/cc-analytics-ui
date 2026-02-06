"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
});

export default function SwaggerUIClient() {
  return (
    <div className="min-h-[80vh] w-full rounded-lg border bg-background">
      <SwaggerUI url="/api/openapi" />
    </div>
  );
}
