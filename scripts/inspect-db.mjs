// One-off read-only inspector for the production (Neon/Postgres) database.
//
// Usage (from expense_app/):
//   npx prisma generate --schema prisma/schema.prisma   # ensure PG client
//   node --env-file=.env scripts/inspect-db.mjs
//
// It never prints DATABASE_URL or any secret — only aggregate counts/sums.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function money(n) {
  return (n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

async function main() {
  const ledgers = await prisma.ledger.findMany({
    select: {
      id: true,
      name: true,
      monthlyBudget: true,
      createdAt: true,
      _count: { select: { expenses: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("======================================================");
  console.log(`SPACES (ledgers): ${ledgers.length}`);
  console.log("======================================================");

  for (const l of ledgers) {
    const agg = await prisma.expense.aggregate({
      where: { ledgerId: l.id },
      _sum: { amount: true },
      _min: { date: true },
      _max: { date: true },
    });
    const created = l.createdAt.toISOString().slice(0, 10);
    const first = agg._min.date ? agg._min.date.toISOString().slice(0, 10) : "-";
    const last = agg._max.date ? agg._max.date.toISOString().slice(0, 10) : "-";
    console.log(
      `• ${l.name}\n` +
        `    expenses: ${l._count.expenses} | total: ${money(agg._sum.amount)} | ` +
        `budget: ${l.monthlyBudget != null ? money(l.monthlyBudget) : "—"}\n` +
        `    created: ${created} | activity: ${first} → ${last}`
    );
  }

  const totalExpenses = await prisma.expense.count();
  const grand = await prisma.expense.aggregate({ _sum: { amount: true } });

  console.log("\n======================================================");
  console.log(`TOTAL EXPENSES: ${totalExpenses} | GRAND TOTAL: ${money(grand._sum.amount)}`);
  console.log("======================================================");

  const byCategory = await prisma.expense.groupBy({
    by: ["category"],
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  console.log("\nBY CATEGORY (all spaces combined):");
  for (const c of byCategory) {
    console.log(`  ${c.category.padEnd(16)} ${String(c._count._all).padStart(4)}×  ${money(c._sum.amount)}`);
  }

  const byPayer = await prisma.expense.groupBy({
    by: ["paidBy"],
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 10,
  });

  console.log("\nTOP PAYERS:");
  for (const p of byPayer) {
    console.log(`  ${(p.paidBy || "—").padEnd(16)} ${String(p._count._all).padStart(4)}×  ${money(p._sum.amount)}`);
  }
}

main()
  .catch((e) => {
    console.error("Query failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
