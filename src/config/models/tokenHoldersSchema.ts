// collection used to cache token holders
import mongoose, { Schema, Document, Model } from "mongoose";
import { Address } from "viem";
import z from "zod";

export interface HolderEntry {
  address: string;
  balance: number;
}

export interface TokenHoldersDocument extends Document {
  token_address: Address;
  initial_block_fetched: number;
  last_block_fetched: number;
  holders: HolderEntry[];
}

export interface TokenHoldersModel extends Model<TokenHoldersDocument> {
  findByTokenAddress(
    token_address: Address
  ): Promise<TokenHoldersDocument | null>;
}

const TokenHoldersSchema: Schema<TokenHoldersDocument> = new Schema({
  token_address: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
  },
  initial_block_fetched: { type: Number, required: true },
  last_block_fetched: { type: Number, required: true },
  holders: [
    {
      address: { type: String, required: true },
      balance: { type: Number, required: true },
    },
  ],
});

TokenHoldersSchema.statics.findByTokenAddress = function (
  token_address: Address
) {
  return this.findOne({ token_address: token_address.toLowerCase() });
};

const TokenHoldersModel = mongoose.model<
  TokenHoldersDocument,
  TokenHoldersModel
>("token_holders_collections", TokenHoldersSchema);
export default TokenHoldersModel;
