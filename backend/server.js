import "dotenv/config"; 
import express from "express";
import cors from "cors";
import connectDB from "./src/config/db.js";
import propertyRoutes from "./src/routes/PropertyRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.use(propertyRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
