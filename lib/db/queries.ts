import { Op, col, fn, type ModelStatic, type Model } from "sequelize";

/** One grouped COUNT: how many rows of `model` belong to each id in `ids`, keyed by `key`. */
export async function countBy(model: ModelStatic<Model>, key: string, ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const rows = (await model.findAll({
    where: { [key]: { [Op.in]: ids } },
    attributes: [key, [fn("COUNT", col("id")), "count"]],
    group: [key],
    raw: true,
  })) as unknown as Record<string, string>[];
  for (const r of rows) map.set(r[key], Number(r.count));
  return map;
}
