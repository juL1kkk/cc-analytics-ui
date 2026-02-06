import { ZodError } from "zod";

export function badRequest(message: string, details?: string[]) {
  return Response.json(
    {
      error: {
        code: "BAD_REQUEST",
        message,
        details,
      },
    },
    { status: 400 },
  );
}

export function internalError(message = "Внутренняя ошибка сервиса") {
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    },
    { status: 500 },
  );
}

export function zodErrorResponse(error: ZodError) {
  const details = error.issues.map((issue) => issue.message);
  return badRequest("Некорректные параметры запроса", details);
}
