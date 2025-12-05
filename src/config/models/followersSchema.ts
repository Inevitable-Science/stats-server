import mongoose, { Schema, Document, Model } from "mongoose";
import z from "zod";

const HistoricalFollowersZ = z.object({
  date: z.date(),
  count: z.number(),
});

export const FollowersSchemaZ = z.object({
  username: z.string(),
  current_followers: z.number(),
  historical_followers: z.array(HistoricalFollowersZ),
});

interface HistoricalFollowers {
  date: Date;
  count: number;
}

export interface FollowersDocument extends Document {
  username: string;
  current_followers: number;
  historical_followers: HistoricalFollowers[];
}

const DataSchema: Schema<FollowersDocument> = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  current_followers: { type: Number, required: true },
  historical_followers: [
    {
      date: { type: Date, required: true },
      count: { type: Number, required: true },
    },
  ],
});

const FollowersModel: Model<FollowersDocument> =
  mongoose.model<FollowersDocument>("followers_collections", DataSchema);

export default FollowersModel;
