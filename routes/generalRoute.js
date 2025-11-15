import express from "express";
import { getAllCountries } from "../controllers/generalController";

const router = express.Router();

router.get("/countries", getAllCountries);

export default router;
