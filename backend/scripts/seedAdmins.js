import "dotenv/config";
import bcrypt from "bcryptjs";
import authConnection from "../src/config/authDb.js";
import User from "../src/models/User.js";

// One-off bootstrap tool: fill this in to create/update admin accounts, then run
// `node scripts/seedAdmins.js`. Only needed to create the very first admin(s) —
// after that, admins can add more admins from the app itself.
const ADMINS = [
  // { name: "", email: "", password: "" },
];

async function seed() {
  await authConnection.asPromise();

  for (const admin of ADMINS) {
    const passwordHash = await bcrypt.hash(admin.password, 10);
    const result = await User.findOneAndUpdate(
      { email: admin.email },
      { name: admin.name, email: admin.email, passwordHash },
      { upsert: true, returnDocument: "after" },
    );
    console.log(`Upserted admin: ${result.email} (${result.name})`);
  }

  await authConnection.close();
  process.exit(0);
}

seed().catch((error) => {
  console.error("Failed to seed admins:", error);
  process.exit(1);
});
