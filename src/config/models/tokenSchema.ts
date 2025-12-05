import mongoose, { Schema, Document, Model } from "mongoose";
import { z } from "zod";

const TopHolderSchema = z.object({
  address: z.string().nullable(),
  token_amount: z.number().nullable(),
  account_type: z.string().nullable(),
});

const TokenDistributionSchema = z.object({
  range: z.string().nullable(),
  accounts: z.string().nullable(),
  amount_tokens_held: z.number().nullable(),
  percent_tokens_held: z.number().nullable(),
});

export const TokenDocumentSchemaZ = z.object({
  token_name: z.string(),
  token_address: z.string(),
  date_added: z.date(),
  last_updated: z.date(),
  total_supply: z.number(),
  market_cap: z.number(),
  average_balance: z.number(),
  median_balance: z.number(),
  total_holders: z.string(),
  top_holders: z.array(TopHolderSchema),
  token_distribution: z.array(TokenDistributionSchema),
  holders_graph: z.array(z.array(z.number())),
});

interface TopHolder {
  address: string | null;
  token_amount: number | null;
  account_type: string | null;
}

interface TokenDistribution {
  range: string | null;
  accounts: string | null;
  amount_tokens_held: number | null;
  percent_tokens_held: number | null;
}

export interface TokenDocument extends Document {
  token_name: string;
  token_address: string;
  date_added: Date;
  last_updated: Date;
  total_supply: number;
  market_cap: number;
  average_balance: number;
  median_balance: number;
  total_holders: string;
  top_holders: TopHolder[];
  token_distribution: TokenDistribution[];
  holders_graph: number[][];
}

const DataSchema: Schema<TokenDocument> = new Schema({
  token_name: { type: String, required: true, unique: true, index: true },
  token_address: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
  },
  date_added: Date,
  last_updated: Date,
  total_supply: Number,
  market_cap: Number,
  average_balance: Number,
  median_balance: Number,
  total_holders: String,
  top_holders: [
    {
      address: { type: String, default: null },
      token_amount: { type: Number, default: null },
      account_type: { type: String, default: null },
    },
  ],
  token_distribution: [
    {
      range: { type: String, default: null },
      accounts: { type: String, default: null },
      amount_tokens_held: { type: Number, default: null },
      percent_tokens_held: { type: Number, default: null },
    },
  ],
  holders_graph: {
    type: [[Number]],
    default: [],
  },
});

const TokenModel: Model<TokenDocument> = mongoose.model<TokenDocument>(
  "token_collections",
  DataSchema
);

export default TokenModel;
