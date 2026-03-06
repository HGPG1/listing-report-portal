import { getDb } from "./server/db.js";
import { weeklyStats } from "./drizzle/schema.js";

const db = await getDb();
const records = await db.select().from(weeklyStats).limit(10);

console.log("Weekly Stats Records:");
console.log(JSON.stringify(records, null, 2));
