import { Router } from "express";
import { ecosystemHandler } from "./ecosystem";
import path from "path"

const router = Router();

router.get("/tokenlist.schema.json", (req, res) => {
  res.sendFile(path.resolve("src/routes/web3/tokenlist.schema.json"));
});
router.get("/ecosystem", ecosystemHandler);

export default router;
