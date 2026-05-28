import { Prisma, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';

const prisma = new PrismaClient();

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
];

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
};

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

// Fisher-Yates Shuffle
function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length;
  let randomIndex: number;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

async function main() {
  console.log('Starting seeding process...');
  const startTime = Date.now();

  // 1. Read first and last names
  const firstNamesPath = path.join(__dirname, '../data/first_names.txt');
  const lastNamesPath = path.join(__dirname, '../data/last_names.txt');

  if (!fs.existsSync(firstNamesPath) || !fs.existsSync(lastNamesPath)) {
    console.error('Error: first_names.txt or last_names.txt is missing!');
    process.exit(1);
  }

  const firstNames = fs
    .readFileSync(firstNamesPath, 'utf8')
    .split(/\r?\n/)
    .map((n) => n.trim())
    .filter(Boolean);
  const lastNames = fs
    .readFileSync(lastNamesPath, 'utf8')
    .split(/\r?\n/)
    .map((n) => n.trim())
    .filter(Boolean);

  console.log(
    `Loaded ${firstNames.length} first names and ${lastNames.length} last names.`,
  );
  const totalCombinations = firstNames.length * lastNames.length;
  console.log(`Total possible unique full names: ${totalCombinations}`);

  if (totalCombinations < 10000) {
    console.error('Error: Not enough names to generate 10,000 unique records.');
    process.exit(1);
  }

  // 2. Generate all unique names
  const allNames: string[] = [];
  for (const firstName of firstNames) {
    for (const lastName of lastNames) {
      allNames.push(`${firstName} ${lastName}`);
    }
  }

  // Shuffle to randomize
  shuffle(allNames);

  // We only need exactly 10,000
  const namesToUse = allNames.slice(0, 10000);

  // 2️⃣ Seed HR manager users
  const managerSeeds = [
    { email: 'manager1@company.com', password: 'password1' },
    { email: 'manager2@company.com', password: 'password2' },
    { email: 'manager3@company.com', password: 'password3' },
  ];

  const managerRecords = await Promise.all(
    managerSeeds.map(async (m) => {
      const hash = await bcrypt.hash(m.password, 10);
      return {
        email: m.email,
        passwordHash: hash,
        role: 'HR_MANAGER' as any,
      };
    }),
  );

  await prisma.user.createMany({ data: managerRecords });

  // 4. Generate records
  const employeesToInsert: Prisma.EmployeeCreateInput[] = [];
  const departmentsList = Object.keys(DEPARTMENTS) as Array<
    keyof typeof DEPARTMENTS
  >;
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const today = new Date();

  // Track emails to ensure absolute uniqueness (in case of name collisions across indices)
  const usedEmails = new Set<string>();

  for (let i = 0; i < namesToUse.length; i++) {
    const fullName = namesToUse[i];
    const [firstName, lastName] = fullName.split(' ');

    // Create base email
    let emailBase = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    let email = `${emailBase}@company.com`;
    let suffix = 1;
    while (usedEmails.has(email)) {
      email = `${emailBase}${suffix}@company.com`;
      suffix++;
    }
    usedEmails.add(email);

    const countryObj = getRandomElement(COUNTRIES);
    const department = getRandomElement(departmentsList);
    const jobTitleObj = getRandomElement(DEPARTMENTS[department]);

    // Scale salary by job title range and country multiplier
    const baseSalary =
      Math.random() * (jobTitleObj.max - jobTitleObj.min) + jobTitleObj.min;
    const finalSalary =
      Math.round((baseSalary * countryObj.multiplier) / 100) * 100;

    const hireDate = getRandomDate(fiveYearsAgo, today);

    employeesToInsert.push({
      fullName,
      email,
      jobTitle: jobTitleObj.title,
      department,
      country: countryObj.name,
      salary: finalSalary,
      hireDate,
    });
  }

  // 5. Insert in chunks
  const CHUNK_SIZE = 500;
  console.log(`Inserting 10,000 employees in chunks of ${CHUNK_SIZE}...`);

  for (let i = 0; i < employeesToInsert.length; i += CHUNK_SIZE) {
    const chunk = employeesToInsert.slice(i, i + CHUNK_SIZE);
    await prisma.employee.createMany({
      data: chunk,
    });
  }

  const duration = (Date.now() - startTime) / 1000;
  const count = await prisma.employee.count();
  console.log(
    `Successfully seeded ${count} employees in ${duration.toFixed(2)}s!`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
