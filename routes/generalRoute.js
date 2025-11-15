import express from "express";
import { getAllCountries } from "../controllers/generalController.js";

const router = express.Router();

router.get("/countries", getAllCountries);

export default router;
