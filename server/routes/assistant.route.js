import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.send("Welcome to the Assistant API");
});

export default router;