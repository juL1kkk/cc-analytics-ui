import type { KpisFilters, KpisResponse } from "./kpis.types";

export async function getMockKpis(_filters: KpisFilters): Promise<KpisResponse> {
  return {
    incoming: 100,
    missed: 7,
    aht: 180,
    load: 0.72,
    fcr: 0.6,
  };
}
