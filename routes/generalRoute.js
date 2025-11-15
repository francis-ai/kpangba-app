import express from "express";
import { 
    getAllCountries,
    getFeaturedProducts,
    getLatestProducts,
    getPopularProducts,
    getSliders,
} from "../controllers/generalController.js";

const router = express.Router();

// Get Countried
router.get("/countries", getAllCountries);

// Get Products
router.get("/products/featured", getFeaturedProducts);
router.get("/products/latest", getLatestProducts);
router.get("/products/popular", getPopularProducts);

// Get Slider
router.get("/sliders", getSliders);


export default router;
