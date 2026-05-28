import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import * as fs from 'fs';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';

// Use WebSockets for NeonDB — reduces per-query latency dramatically
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter } as any);

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const COUNTRIES = [
  { name: 'United States', multiplier: 1.0 },
  { name: 'Canada', multiplier: 0.85 },
  { name: 'United Kingdom', multiplier: 0.8 },
  { name: 'Germany', multiplier: 0.85 },
  { name: 'India', multiplier: 0.3 },
  { name: 'Singapore', multiplier: 0.95 },
  { name: 'Australia', multiplier: 0.9 },
  { name: 'France', multiplier: 0.75 },
  { name: 'Japan', multiplier: 0.7 },
  { name: 'Brazil', multiplier: 0.35 },
] as const;

const DEPARTMENTS = {
  Engineering: [
    { title: 'Software Engineer', min: 70000, max: 120000 },
    { title: 'Senior Software Engineer', min: 110000, max: 170000 },
    { title: 'Engineering Manager', min: 130000, max: 200000 },
    { title: 'DevOps Engineer', min: 75000, max: 130000 },
    { title: 'QA Engineer', min: 60000, max: 100000 },
  ],
  Sales: [
    { title: 'Sales Representative', min: 45000, max: 80000 },
    { title: 'Account Executive', min: 65000, max: 110000 },
    { title: 'Sales Manager', min: 90000, max: 150000 },
  ],
  Marketing: [
    { title: 'Marketing Specialist', min: 50000, max: 85000 },
    { title: 'Marketing Manager', min: 80000, max: 130000 },
    { title: 'SEO Analyst', min: 45000, max: 75000 },
  ],
  HR: [
    { title: 'HR Specialist', min: 50000, max: 80000 },
    { title: 'HR Manager', min: 85000, max: 140000 },
    { title: 'Recruiter', min: 45000, max: 80000 },
  ],
  Finance: [
    { title: 'Accountant', min: 55000, max: 90000 },
    { title: 'Financial Analyst', min: 65000, max: 110000 },
    { title: 'Finance Manager', min: 95000, max: 160000 },
  ],
  Product: [
    { title: 'Product Manager', min: 80000, max: 140000 },
    { title: 'Senior Product Manager', min: 120000, max: 180000 },
  ],
  Design: [
    { title: 'UI/UX Designer', min: 60000, max: 110000 },
    { title: 'Lead Designer', min: 100000, max: 160000 },
  ],
} as const;

type Department = keyof typeof DEPARTMENTS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

/** Fisher-Yates in-place shuffle */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Bulk-insert helpers — sends one large statement per chunk instead of N
// ---------------------------------------------------------------------------

/**
 * Raw bulk-insert for employees.
 * Prisma's createMany issues one INSERT per call; we batch into a single
 * parameterised statement which dramatically cuts round-trips to NeonDB.
 */
async function bulkInsertEmployees(
  rows: {
    fullName: string;
    email: string;
    jobTitle: string;
    department: string;
    country: string;
    salary: number;
    hireDate: Date;
  }[],
) {
  if (rows.length === 0) return;

  // Build ($1,$2,...), ($8,$9,...) placeholders
  const COLS = 7; // columns per row
  const valuePlaceholders = rows
    .map((_, i) => {
      const base = i * COLS;
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`;
    })
    .join(',');

  const flatParams: (string | number | Date)[] = [];
  for (const r of rows) {
    flatParams.push(
      r.fullName,
      r.email,
      r.jobTitle,
      r.department,
      r.country,
      r.salary,
      r.hireDate,
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Employee" ("fullName","email","jobTitle","department","country","salary","hireDate")
     VALUES ${valuePlaceholders}`,
    ...flatParams,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Starting optimised seed for NeonDB…');
  const t0 = Date.now();

  // 1. Load names -----------------------------------------------------------
  const dataDir = path.join(__dirname, '../data');
  const firstNames = fs
    .readFileSync(path.join(dataDir, 'first_names.txt'), 'utf8')
    .split(/\r?\n/)
    .map((n) => n.trim())
    .filter(Boolean);
  const lastNames = fs
    .readFileSync(path.join(dataDir, 'last_names.txt'), 'utf8')
    .split(/\r?\n/)
    .map((n) => n.trim())
    .filter(Boolean);

  console.log(
    `Loaded ${firstNames.length} first × ${lastNames.length} last names.`,
  );
  if (firstNames.length * lastNames.length < 10_000) {
    console.error('Not enough name combinations for 10 000 unique records.');
    process.exit(1);
  }

  // 2. Generate 10 000 unique names (shuffle lazily — stop at 10 000) -------
  //    Avoids building the full M×N array when we only need a slice.
  const namesToUse: string[] = [];
  const seen = new Set<string>();

  outer: for (const fn of shuffle([...firstNames])) {
    for (const ln of shuffle([...lastNames])) {
      const name = `${fn} ${ln}`;
      if (!seen.has(name)) {
        seen.add(name);
        namesToUse.push(name);
        if (namesToUse.length === 10_000) break outer;
      }
    }
  }

  // 3. Hash passwords in parallel — bcrypt is CPU-bound; Promise.all
  //    lets Node overlap the work instead of awaiting each sequentially. ----
  console.log('Hashing manager passwords in parallel…');
  const managerSeeds = [
    { email: 'manager1@company.com', password: 'password1' },
    { email: 'manager2@company.com', password: 'password2' },
    { email: 'manager3@company.com', password: 'password3' },
  ];

  const managerRecords = await Promise.all(
    managerSeeds.map(async (m) => ({
      email: m.email,
      passwordHash: await bcrypt.hash(m.password, 10),
      role: 'HR_MANAGER' as const,
    })),
  );

  // 4. Build employee rows in-memory (pure CPU — no I/O, do it all at once) -
  const departments = Object.keys(DEPARTMENTS) as Department[];
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const today = new Date();
  const usedEmails = new Set<string>();

  const employeeRows = namesToUse.map((fullName) => {
    const [firstName, lastName] = fullName.split(' ');
    const emailBase = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    let email = `${emailBase}@company.com`;
    let suffix = 1;
    while (usedEmails.has(email)) email = `${emailBase}${suffix++}@company.com`;
    usedEmails.add(email);

    const countryObj = pick(COUNTRIES);
    const dept = pick(departments);
    const jobTitleObj = pick(DEPARTMENTS[dept]);
    const salary =
      Math.round(
        ((Math.random() * (jobTitleObj.max - jobTitleObj.min) +
          jobTitleObj.min) *
          countryObj.multiplier) /
          100,
      ) * 100;

    return {
      fullName,
      email,
      jobTitle: jobTitleObj.title,
      department: dept,
      country: countryObj.name,
      salary,
      hireDate: randDate(fiveYearsAgo, today),
    };
  });

  // 5. Write to DB — managers first, then employees in large chunks ----------
  //    Larger chunks = fewer round-trips over the NeonDB WebSocket.
  //    2 000 rows/chunk keeps each statement comfortably under Postgres'
  //    65 535 parameter limit (7 cols × 2000 = 14 000 params).
  const CHUNK_SIZE = 2_000;

  console.log('Inserting managers…');
  await prisma.user.createMany({ data: managerRecords });

  console.log(
    `Inserting ${employeeRows.length} employees in chunks of ${CHUNK_SIZE}…`,
  );
  for (let i = 0; i < employeeRows.length; i += CHUNK_SIZE) {
    await bulkInsertEmployees(employeeRows.slice(i, i + CHUNK_SIZE));
    process.stdout.write(
      `  ${Math.min(i + CHUNK_SIZE, employeeRows.length)} / ${employeeRows.length}\r`,
    );
  }

  const count = await prisma.employee.count();
  console.log(
    `\nDone. ${count} employees seeded in ${((Date.now() - t0) / 1000).toFixed(2)}s`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => Promise.all([prisma.$disconnect(), pool.end()]));
