import SwaggerUIClient from "@/components/SwaggerUIClient";

export default function SwaggerPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Swagger</h1>
        <p className="text-sm text-muted-foreground">
          Интерактивная документация API (OpenAPI). Используется для тестирования
          backend до подключения UI.
        </p>
      </div>
      <SwaggerUIClient />
    </div>
  );
}
