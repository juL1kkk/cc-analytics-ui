import { query } from "../db";
import type { KpisFilters, KpisResponse } from "./kpis.types";

const IN_DIR = "inbound";

export async function getRealKpis(
  filters: KpisFilters
): Promise<KpisResponse> {
  const { from, to, channel, queue, operator } = filters;

  const args: unknown[] = [from, to, IN_DIR];
  let idx = 4;
  const conds: string[] = [];

  if (channel) {
    conds.push(`ch."code" = $${idx++}`);
    args.push(channel);
  }

  if (queue) {
    conds.push(`q."code" = $${idx++}`);
    args.push(queue);
  }

  if (operator) {
    conds.push(`u."login" = $${idx++}`);
    args.push(operator);
  }

  const whereExtra = conds.length ? `and ${conds.join(" and ")}` : "";

  const sql = `
    select
      count(*) filter (where f.direction = $3)::int as incoming,

      count(*) filter (
        where f.direction = $3
          and f.answer_stamp is null
      )::int as missed,

      coalesce(avg(f.billsec) filter (
        where f.direction = $3
          and f.answer_stamp is not null
      ), 0)::float as aht

    from cc_replica."Call" c
    join cc_replica."FsCdr" f
      on f.id = c.fs_uuid

    left join cc_replica."Channel" ch
      on ch.id = c.channel_id

    left join cc_replica."Queues" q
      on q.id = c.queue_id

    left join cc_replica."User" u
      on u.id = c.user_id

    where f.start_stamp >= $1
      and f.start_stamp <  $2
      and c."active" = true
      ${whereExtra}
  `;

  const { rows } = await query<{
    incoming: number;
    missed: number;
    aht: number;
  }>(sql, args);

  const r = rows?.[0];

  return {
    incoming: Number(r?.incoming ?? 0),
    missed: Number(r?.missed ?? 0),
    aht: Number(r?.aht ?? 0),
    load: 0,
    fcr: 0,
  };
}
