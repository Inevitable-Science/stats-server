import mongoose, { Schema, Document, Model } from "mongoose";

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
