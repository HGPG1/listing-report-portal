import { getDb } from "./server/db.ts";
import { listings } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const listingsToAdd = [
  { mlsNumber: "4342358", address: "7416 Hartsfield Drive", city: "Lancaster", status: "Active" },
  { mlsNumber: "4336731", address: "13002 Butters Way #44", city: "Charlotte", status: "Active" },
  { mlsNumber: "4222460", address: "00 Stratton Farm Road", city: "Huntersville", status: "Active" },
  { mlsNumber: "4346944", address: "1131 Sikes Mill Road", city: "Monroe", status: "Active" },
  { mlsNumber: "4341869", address: "11230 Mallard Crossing Drive", city: "Charlotte", status: "Active" },
  { mlsNumber: "4311448", address: "11058 Argosy Drive", city: "Lancaster", status: "Active" },
  { mlsNumber: "4304524", address: "181 Jeter Street", city: "Chester", status: "Active" },
];

async function addListings() {
  try {
    const db = await getDb();
    if (!db) {
      console.error("Database not available");
      process.exit(1);
    }

    for (const listing of listingsToAdd) {
      // Check if listing already exists
      const existing = await db
        .select()
        .from(listings)
        .where(eq(listings.mlsNumber, listing.mlsNumber));

      if (existing.length === 0) {
        await db.insert(listings).values({
          mlsNumber: listing.mlsNumber,
          address: listing.address,
          city: listing.city,
          status: listing.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`✓ Added listing: ${listing.mlsNumber} - ${listing.address}`);
      } else {
        console.log(`- Listing already exists: ${listing.mlsNumber}`);
      }
    }

    console.log("Done!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

addListings();
