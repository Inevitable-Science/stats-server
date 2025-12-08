import { Router, Request, Response } from "express";

const path = require("path");

const router = Router();

router.get("/tokenlist.schema.json", (req, res) => {
  res.sendFile(path.resolve("src/routes/web3/tokenlist/tokenlist.schema.json"));
});

export default router;
