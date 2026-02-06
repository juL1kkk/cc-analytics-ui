import { NextResponse } from "next/server";

type OperatorRow = {
  operator_id: number;
  operator_name_ru: string;
  handled: number;
  missed: number;
  aht_sec: number | null;
  fcr_pct: number | null;
};

type OperatorTrendRow = {
  t: string;
  aht_sec: number | null;
  asa_sec: number | null;
};

export function GET() {
  const rows: OperatorRow[] = [];
  const trendRows: OperatorTrendRow[] = [];

  const items = rows.map((row) => ({
    operatorId: row.operator_id,
    operatorNameRu: row.operator_name_ru,
    handled: row.handled,
    missed: row.missed,
    ahtSec: row.aht_sec,
    fcrPct: row.fcr_pct,
  }));

  const trend = trendRows.map((row) => ({
    t: row.t,
    ahtSec: row.aht_sec,
    asaSec: row.asa_sec,
  }));

  return NextResponse.json({ items, trend });
}
