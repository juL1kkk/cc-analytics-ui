"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function SwaggerUIClient() {
  // если у вас спека лежит по другому URL — поменяй здесь
  const specUrl = "/api/openapi";

  return (
    <div className="w-full">
      <SwaggerUI url={specUrl} docExpansion="list" />
    </div>
  );
}
