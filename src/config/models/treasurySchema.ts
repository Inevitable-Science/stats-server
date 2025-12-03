import mongoose, { Schema, Document, Model } from "mongoose";
import z from "zod";

const TokenSchema = z.object({
  contractAddress: z.string(),
  metadata: z.object({
    name: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  }),
  rawBalance: z.string(),
  decodedBalance: z.number(),
  price: z.number(),
  totalValue: z.number(),
});

const HistoricalTreasurySchema = z.object({
  date: z.date(),
  balance: z.string(),
  assets: z.string(),
});

export const TreasuryDocumentSchemaZ = z.object({
  dao_name: z.string(),
  date_added: z.date(),
  last_updated: z.date(),
  total_treasury_value: z.string(),
  total_assets: z.string(),
  tokens: z.array(TokenSchema),
  historical_treasury: z.array(HistoricalTreasurySchema),
});

export type TreasuryDocumentType = z.infer<typeof TreasuryDocumentSchemaZ>

interface Token {
  contractAddress: string;
  metadata: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rawBalance: string;
  decodedBalance: number;
  price: number;
  totalValue: number;
}

export interface HistoricalTreasury {
  date: Date;
  balance: string;
  assets: string;
}

export interface TreasuryDocument extends Document {
  dao_name: string;
  date_added: Date;
  last_updated: Date;
  total_treasury_value: string;
  total_assets: string;
  tokens: Token[];
  historical_treasury: HistoricalTreasury[];
}

const DataSchema: Schema<TreasuryDocument> = new Schema({
  dao_name: { type: String, required: true, unique: true, index: true },
  date_added: Date,
  last_updated: Date,
  total_treasury_value: String,
  total_assets: String,
  tokens: [
    {
      contractAddress: String,
      metadata: {
        name: String,
        symbol: String,
        decimals: { type: Number, required: true },
      },
      rawBalance: String,
      decodedBalance: { type: Number, required: true },
      price: { type: Number, required: true },
      totalValue: { type: Number, required: true },
    },
  ],
  historical_treasury: [
    {
      date: Date,
      balance: String,
      assets: String,
    },
  ],
});

const TreasuryModel: Model<TreasuryDocument> = mongoose.model<TreasuryDocument>(
  "treasury_collections",
  DataSchema
);

export default TreasuryModel;
