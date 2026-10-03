// ?page=1&limit=20  ->  { page, limit, skip }
function getPagination(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

async function paginate(model, filter, query, { sort = { createdAt: -1 }, select, populate } = {}) {
  const { page, limit, skip } = getPagination(query);
  let q = model.find(filter).sort(sort).skip(skip).limit(limit);
  if (select) q = q.select(select);
  if (populate) q = q.populate(populate);
  const [items, total] = await Promise.all([q.lean(), model.countDocuments(filter)]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) || 1 };
}

// escape user input before using it in a RegExp search
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = { getPagination, paginate, escapeRegex };