"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUIAny = SwaggerUI as unknown as React.FC<any>;

export default function SwaggerUIClient() {
  const specUrl = "/api/openapi";

  return (
    <div className="w-full">
      <SwaggerUIAny
        url={specUrl}
        swaggerOptions={{ docExpansion: "list" }}
      />
    </div>
  );
}
