import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    img: { type: String, required: true },
   price: { type: Number, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    type: { type: String, required: true },
    info1: { type: String },
    rooms: { type: Number, required: true, min: 0 },
    floor: { type: Number, required: true, min: -1 },
    size: { type: Number, required: true, min: 0 },
    tags: { type: [String], default: [] },
    description: { type: String },
  },
  { timestamps: true },
);

export default mongoose.model("apartments", propertySchema);
