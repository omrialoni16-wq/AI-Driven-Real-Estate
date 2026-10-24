import mongoose from "mongoose";

// One document per demo session that has used its one chat message. Kept in
// the database rather than in memory because on Vercel each function instance
// has its own memory. Deleted automatically once the 1h demo token expires.
const demoChatSchema = new mongoose.Schema({
  _id: { type: String }, // the demoId from the demo JWT
  usedAt: { type: Date, default: Date.now, expires: 60 * 60 },
});

export default mongoose.model("demo_chats", demoChatSchema);
