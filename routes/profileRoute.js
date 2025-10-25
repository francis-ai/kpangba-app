import express from "express";
import { getCustomerProfile } from "../controllers/profileController.js";

const router = express.Router();

router.get("/:id", getCustomerProfile);

export default router;
