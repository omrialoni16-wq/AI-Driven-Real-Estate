import mongoose from "mongoose";

const authConnection = mongoose.createConnection(process.env.AUTH_MONGO_URI);

authConnection.on("connected", () => {
  console.log("Connected to Auth MongoDB Successfully");
});

authConnection.on("error", (error) => {
  console.error("Failed to connect to Auth MongoDB", error.message);
  process.exit(1);
});

export default authConnection;
