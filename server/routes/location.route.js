import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.send("Welcome to the Location API");
});

export default router;