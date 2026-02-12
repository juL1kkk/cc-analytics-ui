export interface KpisFilters {
  from: string;
  to: string;
  channel?: string;   // code, например "voice"
  queue?: string;     // code, например "1"
  operator?: string;  // login, например "call_center_user"
}

export interface KpisResponse {
  incoming: number;
  missed: number;
  aht: number;
  load: number;
  fcr: number;
}
